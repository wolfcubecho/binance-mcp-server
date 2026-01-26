import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Binance from 'binance-api-node';
import { getBinanceConfig, getServerConfig, validateEnvironment } from './config/binance.js';
import { logError, sanitizeError } from './utils/error-handling.js';
import { marketDataTools } from './tools/market-data.js';
import { accountTools } from './tools/account.js';
import { tradingTools } from './tools/trading.js';
import { futuresTools } from './tools/futures.js';
import { createRetryProxy } from './utils/retry.js';

export class BinanceMCPServer {
  private server: Server;
  private binanceClient: ReturnType<typeof Binance>;
  private tools: Map<string, any>;
  private concurrency = { current: 0, max: Number(process.env.MCP_CONCURRENCY || '4'), queue: [] as Array<() => void> };

  constructor() {
    validateEnvironment();
    
    const config = getBinanceConfig();
    const serverConfig = getServerConfig();
    
    this.server = new Server({
      name: serverConfig.name,
      version: serverConfig.version,
    });

        const rawClient = Binance({
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
          httpBase: config.sandbox ? 'https://testnet.binance.vision' : 'https://api.binance.com',
          getTime: () => Date.now(),
      });
        // Wrap client with retry/backoff to improve reliability under rate limits/timeouts
        this.binanceClient = createRetryProxy(rawClient as any, 'binance');

    this.tools = new Map();
    this.setupTools();
    this.setupHandlers();
  }

  private setupTools(): void {
    const allTools = [
      ...marketDataTools,
      ...accountTools,
      ...tradingTools,
      ...futuresTools,
    ];

    for (const tool of allTools) { if (!tool) continue;
      this.tools.set(tool.name, tool);
    }
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const acquire = async () => {
        if (this.concurrency.current < this.concurrency.max) { this.concurrency.current++; return; }
        await new Promise<void>(resolve => this.concurrency.queue.push(resolve));
        this.concurrency.current++;
      };
      const release = () => {
        this.concurrency.current = Math.max(0, this.concurrency.current - 1);
        const next = this.concurrency.queue.shift(); if (next) next();
      };
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      const started = Date.now();
      try {
        await acquire();
        const result = await tool.handler(this.binanceClient, args);
        if (process.env.LOG_LEVEL === 'debug') {
          const ms = Date.now() - started;
          console.error(`[perf] tool=${name} durMs=${ms} inflight=${this.concurrency.current}`);
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logError(error as Error);
        
        if (error instanceof Error) {
          const sanitizedMessage = sanitizeError(error);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: true,
                  message: sanitizedMessage,
                  type: error.name || 'Error',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: true,
                message: 'Unknown error occurred',
                type: 'UnknownError',
              }, null, 2),
            },
          ],
          isError: true,
        };
      } finally {
        release();
      }
    });
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    console.error(`Binance MCP Server started with ${this.tools.size} tools`);
    await this.server.connect(transport);
  }

  public getServer(): Server {
    return this.server;
  }
}
