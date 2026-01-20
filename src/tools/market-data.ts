import {
  GetPriceSchema,
  GetOrderBookSchema,
  GetKlinesSchema,
  Get24hrTickerSchema,
  GetMarketSnapshotSchema,
  GetMarketSnapshotsSchema,
} from '../types/mcp.js';
import { validateInput, validateSymbol } from '../utils/validation.js';
import { handleBinanceError, sanitizeError } from '../utils/error-handling.js';

// Simple in-memory cache with TTL
const BINANCE_CACHE_TTL_MS = parseInt(process.env.BINANCE_CACHE_TTL || '10000', 10);
type CacheEntry = { ts: number; data: any };
const cache: Map<string, CacheEntry> = new Map();

function cacheKey(name: string, params: any): string {
  const sorted = Object.keys(params || {}).sort().reduce((acc: any, k) => { acc[k] = (params as any)[k]; return acc; }, {} as any);
  return `${name}|${JSON.stringify(sorted)}`;
}

function getCached(name: string, params: any): any | null {
  const key = cacheKey(name, params);
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < BINANCE_CACHE_TTL_MS) return entry.data;
  return null;
}

function setCached(name: string, params: any, data: any): void {
  const key = cacheKey(name, params);
  cache.set(key, { ts: Date.now(), data });
}

export const marketDataTools = [
  {
    name: 'get_price',
    description: 'Obtaineth the current price of a specified trading pair',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol, as BTCUSDT doth appear',
        },
        compact: {
          type: 'boolean',
          description: 'If true, return trimmed result',
        },
      },
      required: ['symbol'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetPriceSchema, args);
      const cached = getCached('get_price', input);
      if (cached) return cached;
      validateSymbol(input.symbol);

      try {
        const price = await binanceClient.prices({ symbol: input.symbol });
        const result = {
          symbol: input.symbol,
          price: price[input.symbol],
          timestamp: Date.now(),
        };
        setCached('get_price', input, result);
        return result;
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_orderbook',
    description: 'Obtaineth the order book depth data',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol, as BTCUSDT doth appear',
        },
        limit: {
          type: 'number',
          description: 'Depth limit, defaulting to a hundred entries',
          default: 100,
        },
        compact: {
          type: 'boolean',
          description: 'If true, return trimmed result',
        },
      },
      required: ['symbol'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetOrderBookSchema, args);
      const cached = getCached('get_orderbook', input);
      if (cached) return cached;
      validateSymbol(input.symbol);

      try {
        const orderBook = await binanceClient.book({
          symbol: input.symbol,
          limit: input.limit ?? 100,
        });

        const result = {
          symbol: input.symbol,
          lastUpdateId: orderBook.lastUpdateId,
          bids: (input.compact ? orderBook.bids.slice(0, Math.min(20, input.limit ?? 100)) : orderBook.bids.slice(0, input.limit ?? 100)).map((bid: any) => ({
            price: bid.price,
            quantity: bid.quantity,
          })),
          asks: (input.compact ? orderBook.asks.slice(0, Math.min(20, input.limit ?? 100)) : orderBook.asks.slice(0, input.limit ?? 100)).map((ask: any) => ({
            price: ask.price,
            quantity: ask.quantity,
          })),
          timestamp: Date.now(),
        };
        setCached('get_orderbook', input, result);
        return result;
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_klines',
    description: 'Obtaineth the candlestick historical data',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol, as BTCUSDT doth appear',
        },
        interval: {
          type: 'string',
          enum: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'],
          description: 'The interval of time\'s passage',
        },
        limit: {
          type: 'number',
          description: 'Quantity limit, defaulting to five hundred',
          default: 500,
        },
        compact: {
          type: 'boolean',
          description: 'If true, return trimmed candles',
        },
      },
      required: ['symbol', 'interval'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetKlinesSchema, args);
      const cached = getCached('get_klines', input);
      if (cached) return cached;
      validateSymbol(input.symbol);

      try {
        const klines = await binanceClient.candles({
          symbol: input.symbol,
          interval: input.interval,
          limit: input.limit,
        });

        const result = {
          symbol: input.symbol,
          interval: input.interval,
          data: (input.compact ? klines.slice(-100) : klines).map((kline: any) => ({
            openTime: kline.openTime,
            open: kline.open,
            high: kline.high,
            low: kline.low,
            close: kline.close,
            volume: kline.volume,
            closeTime: kline.closeTime,
            quoteAssetVolume: kline.quoteAssetVolume,
            numberOfTrades: kline.numberOfTrades,
            takerBuyBaseAssetVolume: kline.takerBuyBaseAssetVolume,
            takerBuyQuoteAssetVolume: kline.takerBuyQuoteAssetVolume,
          })),
          timestamp: Date.now(),
        };
        setCached('get_klines', input, result);
        return result;
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_24hr_ticker',
    description: 'Obtaineth the 24-hour price change statistics',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol, or all pairs if none be specified',
        },
        compact: {
          type: 'boolean',
          description: 'If true, return selected fields only',
        },
      },
      required: [],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(Get24hrTickerSchema, args);
      const cached = getCached('get_24hr_ticker', input);
      if (cached) return cached;
      
      if (input.symbol) {
        validateSymbol(input.symbol);
      }

      try {
        if (input.symbol) {
          const ticker = await binanceClient.dailyStats({ symbol: input.symbol });
          const result = {
            symbol: input.symbol,
            data: input.compact ? {
              priceChange: ticker.priceChange,
              priceChangePercent: ticker.priceChangePercent,
              weightedAvgPrice: ticker.weightedAvgPrice,
              lastPrice: ticker.lastPrice,
              highPrice: ticker.highPrice,
              lowPrice: ticker.lowPrice,
              volume: ticker.volume,
              quoteVolume: ticker.quoteVolume,
            } : ticker,
            timestamp: Date.now(),
          };
          setCached('get_24hr_ticker', input, result);
          return result;
        } else {
          const tickers = await binanceClient.dailyStats();
          const data = Array.isArray(tickers) ? tickers : [tickers];
          const trimmed = input.compact ? data.slice(0, 50).map((t: any) => ({
            symbol: t.symbol,
            lastPrice: t.lastPrice,
            priceChangePercent: t.priceChangePercent,
            volume: t.volume,
          })) : data;
          const result = {
            data: trimmed,
            timestamp: Date.now(),
          };
          setCached('get_24hr_ticker', input, result);
          return result;
        }
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  // Heavy-lift market snapshot for spot symbols
  {
    name: 'get_market_snapshot',
    description: 'Aggregated market snapshot with OHLCV analysis (spot): pivots, FVGs, BOS, EMAs, ATR, RSI, order blocks, liquidity zones, VWAP, daily/weekly opens, previous day high/low, SFP detection',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Trading pair symbol (e.g., BTCUSDT)' },
        interval: { type: 'string', enum: ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d'], description: 'Interval to analyze' },
        limit: { type: 'number', description: 'Candles to analyze (default 150)' },
        compact: { type: 'boolean', description: 'Return trimmed summary (default true)' },
        emas: { type: 'array', items: { type: 'number' }, description: 'EMA periods (e.g., [20,50,200])' },
        atrPeriod: { type: 'number', description: 'ATR period (e.g., 14)' },
        fvgLookback: { type: 'number', description: 'Bars to scan for FVGs' },
      },
      required: ['symbol','interval']
    },
    handler: async (binanceClient: any, args: unknown) => {
      const { symbol, interval, limit = 150, compact = true, emas = [20,50,200], atrPeriod = 14, fvgLookback = 60 } = validateInput(GetMarketSnapshotSchema, args) as any;
      validateSymbol(symbol);
      try {
        const klines = await binanceClient.candles({ symbol, interval, limit });
        const candles: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }> = klines.map((k: any) => ({
          timestamp: k.openTime,
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: parseFloat(k.volume),
        }));
        if (!candles.length) return { symbol, error: 'no_candles' };
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const opens = candles.map(c => c.open);
        const volumes = candles.map(c => c.volume);
        const timestamps = candles.map(c => c.timestamp);

        // Pivots
        const pivots: Array<{ idx: number; type: 'H'|'L'; price: number }> = [];
        for (let i = 1; i < candles.length - 1; i++) {
          if (highs[i] > highs[i-1] && highs[i] > highs[i+1]) pivots.push({ idx: i, type: 'H', price: highs[i] });
          if (lows[i] < lows[i-1] && lows[i] < lows[i+1]) pivots.push({ idx: i, type: 'L', price: lows[i] });
        }
        const lastClose = closes[closes.length - 1];
        const prevHigh = Math.max(...highs.slice(0, highs.length - 1));
        const prevLow = Math.min(...lows.slice(0, lows.length - 1));
        let bos: 'up'|'down'|null = null; if (lastClose > prevHigh) bos = 'up'; else if (lastClose < prevLow) bos = 'down';

        // FVGs
        const fvg: Array<{ type: 'bull'|'bear'; from: number; to: number; startIdx: number }> = [];
        for (let i = Math.max(2, candles.length - (fvgLookback + 2)); i < candles.length; i++) {
          if (lows[i] > highs[i-2]) fvg.push({ type: 'bull', from: highs[i-2], to: lows[i], startIdx: i-2 });
          if (highs[i] < lows[i-2]) fvg.push({ type: 'bear', from: highs[i], to: lows[i-2], startIdx: i-2 });
        }

        // Trend & EMA
        const sma = (arr: number[], n: number) => { if (arr.length < n) return null; let s = 0; for (let i = arr.length - n; i < arr.length; i++) s += arr[i]; return s / n; };
        const sma50 = sma(closes, 50); const sma200 = sma(closes, 200);
        const trend = sma50 && sma200 ? (sma50 > sma200 ? 'up' : 'down') : null;
        const calcEMA = (arr: number[], n: number) => { if (arr.length < n) return null; const k = 2 / (n + 1); let ema = arr[0]; for (let i = 1; i < arr.length; i++) ema = arr[i] * k + ema * (1 - k); return ema; };
        const emaValues: Record<string, number | null> = {}; for (const p of emas) emaValues[`ema${p}`] = calcEMA(closes, p);

        // ATR (RMA)
        const tr: number[] = []; for (let i = 0; i < candles.length; i++) { const hl = highs[i] - lows[i]; const hc = i > 0 ? Math.abs(highs[i] - closes[i-1]) : 0; const lc = i > 0 ? Math.abs(lows[i] - closes[i-1]) : 0; tr.push(Math.max(hl, hc, lc)); }
        const rma = (arr: number[], n: number) => { if (arr.length < n) return null; let sum = 0; for (let i = 0; i < n; i++) sum += arr[i]; let val = sum / n; const alpha = 1 / n; for (let i = n; i < arr.length; i++) val = alpha * arr[i] + (1 - alpha) * val; return val; };
        const atr = rma(tr, atrPeriod);

        // RSI(14)
        const periodRSI = 14; const deltas: number[] = []; for (let i = 1; i < closes.length; i++) deltas.push(closes[i] - closes[i-1]);
        const gains = deltas.map(d => (d > 0 ? d : 0)); const losses = deltas.map(d => (d < 0 ? -d : 0));
        const avgGain = rma(gains, periodRSI); const avgLoss = rma(losses, periodRSI);
        let rsi: number | null = null; if (avgGain !== null && avgLoss !== null) { if (avgLoss === 0) rsi = 100; else if (avgGain === 0) rsi = 0; else { const rs = (avgGain as number) / (avgLoss as number); rsi = 100 - 100 / (1 + rs); } }

        // Liquidity zones
        const tolerance = atr ? atr * 0.1 : (closes[closes.length - 1] * 0.001);
        const pivotHighs = pivots.filter(p => p.type === 'H'); const pivotLows = pivots.filter(p => p.type === 'L');
        const clusterLevels = (points: Array<{ idx: number; price: number }>) => { const sorted = points.slice().sort((a,b)=>a.price-b.price); const clusters: Array<{ level: number; count: number; indices: number[] }> = []; for (const pt of sorted) { const last = clusters[clusters.length - 1]; if (last && Math.abs(pt.price - last.level) <= tolerance) { const newCount = last.count + 1; const newLevel = (last.level * last.count + pt.price) / newCount; last.level = newLevel; last.count = newCount; last.indices.push(pt.idx); } else { clusters.push({ level: pt.price, count: 1, indices: [pt.idx] }); } } return clusters.filter(c => c.count >= 2); };
        const liquidityZones = { highs: clusterLevels(pivotHighs.map(ph => ({ idx: ph.idx, price: ph.price }))), lows: clusterLevels(pivotLows.map(pl => ({ idx: pl.idx, price: pl.price }))) };

        // Order Blocks (BOS context)
        const orderBlocks: Array<{ type: 'bull'|'bear'; idx: number; open: number; high: number; low: number; close: number }> = [];
        const lookbackOB = Math.min(candles.length - 1, 60);
        if (bos === 'up') { for (let i = candles.length - 3; i >= candles.length - lookbackOB; i--) { if (opens[i] > closes[i]) { const upMomentum = (closes[i+1] > closes[i]) && (closes[i+2] >= closes[i+1]); const brokeHigh = lastClose > prevHigh; if (upMomentum || brokeHigh) { orderBlocks.push({ type: 'bull', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; } } } }
        else if (bos === 'down') { for (let i = candles.length - 3; i >= candles.length - lookbackOB; i--) { if (opens[i] < closes[i]) { const downMomentum = (closes[i+1] < closes[i]) && (closes[i+2] <= closes[i+1]); const brokeLow = lastClose < prevLow; if (downMomentum || brokeLow) { orderBlocks.push({ type: 'bear', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; } } } }

        // VWAP (window)
        let vwap: number | null = null; if (candles.length > 0) { let tpVolSum = 0, volSum = 0; for (let i = 0; i < candles.length; i++) { const tp = (highs[i] + lows[i] + closes[i]) / 3; const v = volumes[i] || 0; tpVolSum += tp * v; volSum += v; } vwap = volSum > 0 ? tpVolSum / volSum : null; }

        // Daily/Weekly opens & Previous Day High/Low (UTC)
        const startOfUTC = (ts: number) => Date.UTC(new Date(ts).getUTCFullYear(), new Date(ts).getUTCMonth(), new Date(ts).getUTCDate());
        const now = timestamps[timestamps.length - 1]; const todayStart = startOfUTC(now); const yesterdayStart = todayStart - 24*60*60*1000; const utcDay = new Date(now).getUTCDay(); const daysSinceMonday = (utcDay + 6) % 7; const weekStart = todayStart - daysSinceMonday * 24*60*60*1000;
        let dailyOpen: number | null = null; let weeklyOpen: number | null = null; let prevDayHigh: number | null = null; let prevDayLow: number | null = null;
        for (let i = 0; i < timestamps.length; i++) { const d0 = startOfUTC(timestamps[i]); if (dailyOpen === null && d0 >= todayStart) dailyOpen = opens[i]; if (weeklyOpen === null && d0 >= weekStart) weeklyOpen = opens[i]; }
        let pdh = -Infinity, pdl = Infinity; for (let i = 0; i < timestamps.length; i++) { const d0 = startOfUTC(timestamps[i]); if (d0 >= yesterdayStart && d0 < todayStart) { if (highs[i] > pdh) pdh = highs[i]; if (lows[i] < pdl) pdl = lows[i]; } }
        prevDayHigh = Number.isFinite(pdh) ? pdh : null; prevDayLow = Number.isFinite(pdl) ? pdl : null;

        // SFP detection (last pivots)
        const lastHighPivot = [...pivots].reverse().find(p => p.type === 'H'); const lastLowPivot = [...pivots].reverse().find(p => p.type === 'L');
        let sfp: { bullish: boolean; bearish: boolean; last?: { type: 'bullish'|'bearish'; idx: number; level: number } } = { bullish: false, bearish: false };
        const checkRange = Math.min(candles.length - 1, 10);
        for (let i = candles.length - checkRange; i < candles.length; i++) {
          if (lastHighPivot && highs[i] > lastHighPivot.price + tolerance && closes[i] < lastHighPivot.price) { sfp.bearish = true; sfp.last = { type: 'bearish', idx: i, level: lastHighPivot.price }; break; }
          if (lastLowPivot && lows[i] < lastLowPivot.price - tolerance && closes[i] > lastLowPivot.price) { sfp.bullish = true; sfp.last = { type: 'bullish', idx: i, level: lastLowPivot.price }; break; }
        }

        const latest = { close: lastClose, high: highs[highs.length-1], low: lows[lows.length-1], ts: timestamps[timestamps.length-1] };
        const snapshot = compact ? { symbol, interval, latest, pivots: pivots.slice(-6), bos, fvg: fvg.slice(-5), trend, sma50, sma200, atr, rsi, orderBlocks, liquidityZones, vwap, dailyOpen, weeklyOpen, prevDayHigh, prevDayLow, sfp, ...emaValues } : { symbol, interval, candles, pivots, bos, fvg, trend, sma50, sma200, atr, rsi, orderBlocks, liquidityZones, vwap, dailyOpen, weeklyOpen, prevDayHigh, prevDayLow, sfp, emaValues };
        return snapshot;
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_market_snapshots',
    description: 'Compute snapshots for multiple spot symbols in one call (efficient analysis)',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: { type: 'array', items: { type: 'string' }, description: 'Symbols to analyze' },
        interval: { type: 'string', enum: ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d'], description: 'Interval to analyze' },
        limit: { type: 'number', description: 'Candles to analyze (default 150)' },
        compact: { type: 'boolean', description: 'Trim results' },
        emas: { type: 'array', items: { type: 'number' }, description: 'EMA periods' },
        atrPeriod: { type: 'number', description: 'ATR period' },
        fvgLookback: { type: 'number', description: 'Bars to scan for FVGs' },
      },
      required: ['symbols','interval']
    },
    handler: async (binanceClient: any, args: unknown) => {
      const { symbols, interval, limit = 150, compact = true, emas = [20,50,200], atrPeriod = 14, fvgLookback = 60 } = validateInput(GetMarketSnapshotsSchema, args) as any;
      const results: any[] = [];
      for (const symbol of symbols) {
        try {
          const klines = await binanceClient.candles({ symbol, interval, limit });
          const candles: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }> = klines.map((k: any) => ({ timestamp: k.openTime, open: parseFloat(k.open), high: parseFloat(k.high), low: parseFloat(k.low), close: parseFloat(k.close), volume: parseFloat(k.volume) }));
          if (!candles.length) { results.push({ symbol, error: 'no_candles' }); continue; }
          const closes = candles.map(c => c.close), highs = candles.map(c => c.high), lows = candles.map(c => c.low), opens = candles.map(c => c.open), volumes = candles.map(c => c.volume), timestamps = candles.map(c => c.timestamp);
          const lastClose = closes[closes.length - 1], prevHigh = Math.max(...highs.slice(0, highs.length - 1)), prevLow = Math.min(...lows.slice(0, lows.length - 1));
          let bos: 'up'|'down'|null = null; if (lastClose > prevHigh) bos = 'up'; else if (lastClose < prevLow) bos = 'down';
          const pivots: Array<{ idx: number; type: 'H'|'L'; price: number }> = []; for (let i = 1; i < candles.length - 1; i++) { if (highs[i] > highs[i-1] && highs[i] > highs[i+1]) pivots.push({ idx: i, type: 'H', price: highs[i] }); if (lows[i] < lows[i-1] && lows[i] < lows[i+1]) pivots.push({ idx: i, type: 'L', price: lows[i] }); }
          const sma = (arr: number[], n: number) => { if (arr.length < n) return null; let s = 0; for (let i = arr.length - n; i < arr.length; i++) s += arr[i]; return s / n; };
          const sma50 = sma(closes, 50), sma200 = sma(closes, 200), trend = sma50 && sma200 ? (sma50 > sma200 ? 'up' : 'down') : null;
          const calcEMA = (arr: number[], n: number) => { if (arr.length < n) return null; const k = 2 / (n + 1); let ema = arr[0]; for (let i = 1; i < arr.length; i++) ema = arr[i] * k + ema * (1 - k); return ema; };
          const emaValues: Record<string, number | null> = {}; for (const p of emas) emaValues[`ema${p}`] = calcEMA(closes, p);
          const tr: number[] = []; for (let i = 0; i < candles.length; i++) { const hl = highs[i] - lows[i]; const hc = i > 0 ? Math.abs(highs[i] - closes[i-1]) : 0; const lc = i > 0 ? Math.abs(lows[i] - closes[i-1]) : 0; tr.push(Math.max(hl, hc, lc)); }
          const rma = (arr: number[], n: number) => { if (arr.length < n) return null; let sum = 0; for (let i = 0; i < n; i++) sum += arr[i]; let val = sum / n; const alpha = 1 / n; for (let i = n; i < arr.length; i++) val = alpha * arr[i] + (1 - alpha) * val; return val; };
          const atr = rma(tr, atrPeriod);
          const periodRSI = 14; const deltas: number[] = []; for (let i = 1; i < closes.length; i++) deltas.push(closes[i] - closes[i-1]); const gains = deltas.map(d => (d > 0 ? d : 0)); const losses = deltas.map(d => (d < 0 ? -d : 0)); const avgGain = rma(gains, periodRSI); const avgLoss = rma(losses, periodRSI); let rsi: number | null = null; if (avgGain !== null && avgLoss !== null) { if (avgLoss === 0) rsi = 100; else if (avgGain === 0) rsi = 0; else { const rs = (avgGain as number) / (avgLoss as number); rsi = 100 - 100 / (1 + rs); } }
          const fvg: Array<{ type: 'bull'|'bear'; from: number; to: number; startIdx: number }> = []; for (let i = Math.max(2, candles.length - (fvgLookback + 2)); i < candles.length; i++) { if (lows[i] > highs[i-2]) fvg.push({ type: 'bull', from: highs[i-2], to: lows[i], startIdx: i-2 }); if (highs[i] < lows[i-2]) fvg.push({ type: 'bear', from: highs[i], to: lows[i-2], startIdx: i-2 }); }
          const tolerance = atr ? atr * 0.1 : (closes[closes.length - 1] * 0.001); const pivotHighs = pivots.filter(p => p.type === 'H'); const pivotLows = pivots.filter(p => p.type === 'L');
          const clusterLevels = (points: Array<{ idx: number; price: number }>) => { const sorted = points.slice().sort((a,b)=>a.price-b.price); const clusters: Array<{ level: number; count: number; indices: number[] }> = []; for (const pt of sorted) { const last = clusters[clusters.length - 1]; if (last && Math.abs(pt.price - last.level) <= tolerance) { const newCount = last.count + 1; const newLevel = (last.level * last.count + pt.price) / newCount; last.level = newLevel; last.count = newCount; last.indices.push(pt.idx); } else { clusters.push({ level: pt.price, count: 1, indices: [pt.idx] }); } } return clusters.filter(c => c.count >= 2); };
          const liquidityZones = { highs: clusterLevels(pivotHighs.map(ph => ({ idx: ph.idx, price: ph.price }))), lows: clusterLevels(pivotLows.map(pl => ({ idx: pl.idx, price: pl.price }))) };
          const orderBlocks: Array<{ type: 'bull'|'bear'; idx: number; open: number; high: number; low: number; close: number }> = [];
          const lookbackOB = Math.min(candles.length - 1, 60);
          if (bos === 'up') { for (let i = candles.length - 3; i >= candles.length - lookbackOB; i--) { if (opens[i] > closes[i]) { const upMomentum = (closes[i+1] > closes[i]) && (closes[i+2] >= closes[i+1]); const brokeHigh = lastClose > prevHigh; if (upMomentum || brokeHigh) { orderBlocks.push({ type: 'bull', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; } } } }
          else if (bos === 'down') { for (let i = candles.length - 3; i >= candles.length - lookbackOB; i--) { if (opens[i] < closes[i]) { const downMomentum = (closes[i+1] < closes[i]) && (closes[i+2] <= closes[i+1]); const brokeLow = lastClose < prevLow; if (downMomentum || brokeLow) { orderBlocks.push({ type: 'bear', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; } } } }
          let vwap: number | null = null; if (candles.length > 0) { let tpVolSum = 0, volSum = 0; for (let i = 0; i < candles.length; i++) { const tp = (highs[i] + lows[i] + closes[i]) / 3; const v = volumes[i] || 0; tpVolSum += tp * v; volSum += v; } vwap = volSum > 0 ? tpVolSum / volSum : null; }
          const startOfUTC = (ts: number) => Date.UTC(new Date(ts).getUTCFullYear(), new Date(ts).getUTCMonth(), new Date(ts).getUTCDate()); const now = timestamps[timestamps.length - 1]; const todayStart = startOfUTC(now); const yesterdayStart = todayStart - 24*60*60*1000; const utcDay = new Date(now).getUTCDay(); const daysSinceMonday = (utcDay + 6) % 7; const weekStart = todayStart - daysSinceMonday * 24*60*60*1000;
          let dailyOpen: number | null = null; let weeklyOpen: number | null = null; let prevDayHigh: number | null = null; let prevDayLow: number | null = null;
          for (let i = 0; i < timestamps.length; i++) { const d0 = startOfUTC(timestamps[i]); if (dailyOpen === null && d0 >= todayStart) dailyOpen = opens[i]; if (weeklyOpen === null && d0 >= weekStart) weeklyOpen = opens[i]; }
          let pdh = -Infinity, pdl = Infinity; for (let i = 0; i < timestamps.length; i++) { const d0 = startOfUTC(timestamps[i]); if (d0 >= yesterdayStart && d0 < todayStart) { if (highs[i] > pdh) pdh = highs[i]; if (lows[i] < pdl) pdl = lows[i]; } }
          prevDayHigh = Number.isFinite(pdh) ? pdh : null; prevDayLow = Number.isFinite(pdl) ? pdl : null;
          const lastHighPivot = [...pivots].reverse().find(p => p.type === 'H'); const lastLowPivot = [...pivots].reverse().find(p => p.type === 'L');
          let sfp: { bullish: boolean; bearish: boolean; last?: { type: 'bullish'|'bearish'; idx: number; level: number } } = { bullish: false, bearish: false };
          const checkRange = Math.min(candles.length - 1, 10);
          for (let i = candles.length - checkRange; i < candles.length; i++) { if (lastHighPivot && highs[i] > lastHighPivot.price + tolerance && closes[i] < lastHighPivot.price) { sfp.bearish = true; sfp.last = { type: 'bearish', idx: i, level: lastHighPivot.price }; break; } if (lastLowPivot && lows[i] < lastLowPivot.price - tolerance && closes[i] > lastLowPivot.price) { sfp.bullish = true; sfp.last = { type: 'bullish', idx: i, level: lastLowPivot.price }; break; } }
          const latest = { close: lastClose, high: highs[highs.length-1], low: lows[lows.length-1], ts: timestamps[timestamps.length-1] };
          results.push(compact ? { symbol, interval, latest, bos, pivots: pivots.slice(-4), trend, sma50, sma200, atr, rsi, orderBlocks, liquidityZones, vwap, dailyOpen, weeklyOpen, prevDayHigh, prevDayLow, sfp, ...emaValues, fvg: fvg.slice(-3) } : { symbol, interval, candles, bos, pivots, trend, sma50, sma200, atr, rsi, orderBlocks, liquidityZones, vwap, dailyOpen, weeklyOpen, prevDayHigh, prevDayLow, sfp, emaValues, fvg });
        } catch (error) {
          results.push({ symbol, error: sanitizeError(error as any) });
        }
      }
      return results;
    },
  },
];