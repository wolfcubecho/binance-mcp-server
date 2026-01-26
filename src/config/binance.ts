import { config } from 'dotenv';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';
import { BinanceConfig } from '../types/binance.js';

config();

export function getBinanceConfig(): BinanceConfig {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  const testnet = process.env.BINANCE_TESTNET === 'true';
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

  if (!apiKey || !apiSecret) {
    throw new Error('BINANCE_API_KEY and BINANCE_API_SECRET must be set in environment variables');
  }

  const baseConfig: BinanceConfig = {
    apiKey,
    apiSecret,
    sandbox: testnet,
    recvWindow: 60000,
    timeout: 15000,
    disableBeautification: true,
  };

  // Add proxy agent if proxy URL is configured
  if (proxyUrl) {
    console.log(`Using proxy: ${proxyUrl}`);
    // Use SOCKS proxy agent for socks5:// URLs, HTTP proxy agent for http:// URLs
    if (proxyUrl.startsWith('socks')) {
      const socksAgent = new SocksProxyAgent(proxyUrl);
      baseConfig.httpAgent = socksAgent;
      baseConfig.httpsAgent = socksAgent;
    } else {
      const httpsAgent = new HttpsProxyAgent(proxyUrl);
      baseConfig.httpAgent = httpsAgent;
      baseConfig.httpsAgent = httpsAgent;
    }
  }
  else {
    // Default keep-alive agent to reduce socket churn
    const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
    (baseConfig as any).httpAgent = keepAliveAgent;
    (baseConfig as any).httpsAgent = keepAliveAgent;
  }

  return baseConfig;
}

export function validateEnvironment(): void {
  const requiredEnvVars = ['BINANCE_API_KEY', 'BINANCE_API_SECRET'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }
}

export function isTestnetEnabled(): boolean {
  return process.env.BINANCE_TESTNET === 'true';
}

export function getNetworkMode(): 'testnet' | 'mainnet' {
  return isTestnetEnabled() ? 'testnet' : 'mainnet';
}

export function getLogLevel(): string {
  return process.env.LOG_LEVEL || 'info';
}

export function getServerConfig(): { name: string; version: string } {
  return {
    name: process.env.MCP_SERVER_NAME || 'binance-mcp-server',
    version: process.env.MCP_SERVER_VERSION || '1.0.0',
  };
}

/**
 * Safety configuration for trading operations
 */
export interface SafetyConfig {
  allowMainnetTrading: boolean;
  maxOrderSizePercent: number; // Max % of account balance per order
  requireConfirmationAbove: number; // % threshold requiring confirmation
  enableRiskWarnings: boolean;
}

export function getSafetyConfig(): SafetyConfig {
  return {
    allowMainnetTrading: process.env.ALLOW_MAINNET_TRADING !== 'false', // Default: true
    maxOrderSizePercent: parseInt(process.env.MAX_ORDER_SIZE_PCT || '80'),
    requireConfirmationAbove: parseInt(process.env.REQUIRE_CONFIRMATION_ABOVE || '50'),
    enableRiskWarnings: process.env.ENABLE_RISK_WARNINGS !== 'false', // Default: true
  };
}

/**
 * Check if mainnet trading is allowed
 */
export function isMainnetTradingAllowed(): boolean {
  return getSafetyConfig().allowMainnetTrading;
}

/**
 * Check if confirmation is required for testnet-only operations
 * This is deprecated - we now use risk-based confirmations instead
 */
export function requiresTestnetForTrading(): boolean {
  return !isMainnetTradingAllowed() || isTestnetEnabled();
}