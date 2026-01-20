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
import { logHOBs, logNote, logSnapshot } from '../utils/telemetry.js';

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
        interval: { type: 'string', enum: ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','2d','4d','1w','2w'], description: 'Interval to analyze' },
        limit: { type: 'number', description: 'Candles to analyze (default 150)' },
        compact: { type: 'boolean', description: 'Return trimmed summary (default true)' },
        emas: { type: 'array', items: { type: 'number' }, description: 'EMA periods (e.g., [20,50,200])' },
        atrPeriod: { type: 'number', description: 'ATR period (e.g., 14)' },
        fvgLookback: { type: 'number', description: 'Bars to scan for FVGs' },
      },
      required: ['symbol','interval']
    },
    handler: async (binanceClient: any, args: unknown) => {
      const { symbol, interval, limit = 150, compact = true, emas = [20,50,200], atrPeriod = 14, fvgLookback = 60, minQuality = 0.6, requireLTFConfirmations = false, excludeInvalidated = true, onlyFullyMitigated = false, veryStrongMinQuality = 0.75, onlyVeryStrong = false, telemetry = false } = validateInput(GetMarketSnapshotSchema, args) as any;
      const normalizeInterval = (iv: string) => (iv === '2d' ? '1d' : iv === '4d' ? '1d' : iv === '2w' ? '1w' : iv);
      const fetchInterval = normalizeInterval(interval);
      validateSymbol(symbol);
      try {
        const klines = await binanceClient.candles({ symbol, interval: fetchInterval, limit });
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

        // Order Blocks (BOS context with sensible fallbacks)
        const orderBlocks: Array<{ type: 'bull'|'bear'; idx: number; open: number; high: number; low: number; close: number }> = [];
        const lookbackOB = Math.min(candles.length - 1, 60);
        if (bos === 'up') {
          for (let i = candles.length - 3; i >= candles.length - lookbackOB; i--) {
            if (opens[i] > closes[i]) {
              const upMomentum = (closes[i+1] > closes[i]) && (closes[i+2] >= closes[i+1]);
              const brokeHigh = lastClose > prevHigh;
              if (upMomentum || brokeHigh) { orderBlocks.push({ type: 'bull', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; }
            }
          }
        } else if (bos === 'down') {
          for (let i = candles.length - 3; i >= candles.length - lookbackOB; i--) {
            if (opens[i] < closes[i]) {
              const downMomentum = (closes[i+1] < closes[i]) && (closes[i+2] <= closes[i+1]);
              const brokeLow = lastClose < prevLow;
              if (downMomentum || brokeLow) { orderBlocks.push({ type: 'bear', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; }
            }
          }
        }

        // Fallback OB when no BOS detected: use displacement or last pivots
        if (orderBlocks.length === 0) {
          const windowN = Math.min(5, closes.length - 1);
          const displacementUp = closes[closes.length - 1] - closes[closes.length - 1 - windowN];
          const displacementDown = closes[closes.length - 1 - windowN] - closes[closes.length - 1];
          const base = atr ?? Math.max(1e-8, highs[highs.length - 1] - lows[lows.length - 1]);
          const threshold = base * 0.8;
          if (displacementUp > threshold) {
            for (let i = candles.length - 2; i >= Math.max(1, candles.length - 1 - lookbackOB); i--) {
              if (opens[i] > closes[i]) { orderBlocks.push({ type: 'bull', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; }
            }
          } else if (displacementDown > threshold) {
            for (let i = candles.length - 2; i >= Math.max(1, candles.length - 1 - lookbackOB); i--) {
              if (opens[i] < closes[i]) { orderBlocks.push({ type: 'bear', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; }
            }
          }
        }
        if (orderBlocks.length === 0) {
          const lastH = [...pivots].reverse().find(p => p.type === 'H');
          const lastL = [...pivots].reverse().find(p => p.type === 'L');
          if (lastH) {
            for (let i = lastH.idx - 1; i >= Math.max(0, lastH.idx - 10); i--) { if (opens[i] > closes[i]) { orderBlocks.push({ type: 'bull', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; } }
          }
          if (orderBlocks.length === 0 && lastL) {
            for (let i = lastL.idx - 1; i >= Math.max(0, lastL.idx - 10); i--) { if (opens[i] < closes[i]) { orderBlocks.push({ type: 'bear', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; } }
          }
        }

        // Hidden Order Blocks (mitigation tracker: wick/partial close without invalidation of OB core)
        const hiddenOrderBlocks: Array<{ type: 'bull'|'bear'; idx: number; zone: { open: number; close: number; high: number; low: number }; revisitIdx: number; wickThrough: boolean; partialClose: boolean; coreUntouched: boolean }> = [];
        for (const ob of orderBlocks) {
          const bodyLow = Math.min(ob.open, ob.close);
          const bodyHigh = Math.max(ob.open, ob.close);
          let revisitIdx = -1;
          for (let i = ob.idx + 1; i < candles.length; i++) {
            if (highs[i] >= bodyLow && lows[i] <= bodyHigh) { revisitIdx = i; break; }
          }
          if (revisitIdx !== -1) {
            if (ob.type === 'bull') {
              const invalidated = closes[revisitIdx] < bodyLow;
              const wickThrough = lows[revisitIdx] < bodyLow && closes[revisitIdx] >= bodyLow;
              const partialClose = closes[revisitIdx] >= bodyLow && closes[revisitIdx] <= bodyHigh;
              if (!invalidated && (wickThrough || partialClose)) {
                hiddenOrderBlocks.push({ type: 'bull', idx: ob.idx, zone: { open: ob.open, close: ob.close, high: ob.high, low: ob.low }, revisitIdx, wickThrough, partialClose, coreUntouched: true });
              }
            } else {
              const invalidated = closes[revisitIdx] > bodyHigh;
              const wickThrough = highs[revisitIdx] > bodyHigh && closes[revisitIdx] <= bodyHigh;
              const partialClose = closes[revisitIdx] >= bodyLow && closes[revisitIdx] <= bodyHigh;
              if (!invalidated && (wickThrough || partialClose)) {
                hiddenOrderBlocks.push({ type: 'bear', idx: ob.idx, zone: { open: ob.open, close: ob.close, high: ob.high, low: ob.low }, revisitIdx, wickThrough, partialClose, coreUntouched: true });
              }
            }
          }
        }

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

        // Enrich hiddenOrderBlocks with HTF/LTF confirmations and quality score
        const intervalMsMap: Record<string, number> = { '1m': 60_000, '3m': 180_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000, '1h': 3_600_000, '2h': 7_200_000, '4h': 14_400_000, '6h': 21_600_000, '8h': 28_800_000, '12h': 43_200_000, '1d': 86_400_000, '2d': 172_800_000, '4d': 345_600_000, '1w': 604_800_000, '2w': 1_209_600_000 };
        const ltfMap: Record<string, string> = { '2w': '1d', '1w': '4h', '4d': '1h', '2d': '30m', '1d': '1h', '12h': '1h', '8h': '30m', '6h': '30m', '4h': '30m', '2h': '15m', '1h': '15m', '30m': '5m', '15m': '5m', '5m': '1m' };
        const tfWeightMap: Record<string, number> = { '1m': 0.5, '5m': 0.7, '15m': 0.8, '30m': 0.9, '1h': 1.0, '4h': 1.1, '1d': 1.2, '2d': 1.25, '4d': 1.3, '1w': 1.35, '2w': 1.4 };
        const intervalMs = intervalMsMap[interval] ?? 3_600_000;
        const ltfInterval = ltfMap[interval] ?? null;
        const volSorted = [...volumes].sort((a,b)=>a-b);
        const vol75 = volSorted[Math.floor(volSorted.length * 0.75)] || 0;
        const baseATR = atr ?? Math.max(1e-8, highs[highs.length - 1] - lows[lows.length - 1]);
        const nearFvg = (type: 'bull'|'bear', obIdx: number) => fvg.some(g => g.type === type && g.startIdx >= obIdx - 2 && g.startIdx <= obIdx + 4);
        const nearestLiquidityScore = (type: 'bull'|'bear', zoneMid: number) => {
          const levels = type === 'bull' ? liquidityZones.lows : liquidityZones.highs;
          let best = Infinity; for (const l of levels) { const d = Math.abs(zoneMid - l.level); if (d < best) best = d; }
          if (!Number.isFinite(best)) return 0; const norm = best / baseATR; return Math.max(0, 1 - Math.min(1, norm));
        };
        const vwapConfluence = (zoneMid: number) => { if (vwap == null) return false; const diff = Math.abs(zoneMid - vwap); return (diff / baseATR) <= 0.5; };
        const hvnConfluence = (obIdx: number) => volumes[obIdx] >= vol75;

        // LTF confirmations helper
        const computeLtfConfirmations = async (revisitTs: number, type: 'bull'|'bear') => {
          try {
            if (!ltfInterval) return { bos: false, choch: false, sfp: false, fvgMitigation: false };
            const ltfLimit = 300;
            const ltfKlines = await binanceClient.candles({ symbol, interval: ltfInterval, limit: ltfLimit });
            const ltfCandles = ltfKlines.map((k: any) => ({ ts: k.openTime, o: parseFloat(k.open), h: parseFloat(k.high), l: parseFloat(k.low), c: parseFloat(k.close) }));
            const windowStart = revisitTs;
            const windowEnd = revisitTs + 3 * intervalMs;
            const subset = ltfCandles.filter((c: { ts: number }) => c.ts >= windowStart && c.ts <= windowEnd);
            if (subset.length < 5) return { bos: false, choch: false, sfp: false, fvgMitigation: false };
            const highsL = subset.map((c: any)=>c.h), lowsL = subset.map((c: any)=>c.l), closesL = subset.map((c: any)=>c.c), opensL = subset.map((c: any)=>c.o);
            // Simple BOS: break of local range in expected direction
            const preRangeHigh = Math.max(...highsL.slice(0, Math.max(1, Math.floor(highsL.length/3))));
            const preRangeLow = Math.min(...lowsL.slice(0, Math.max(1, Math.floor(lowsL.length/3))));
            const bos = type === 'bull' ? (Math.max(...closesL) > preRangeHigh) : (Math.min(...closesL) < preRangeLow);
            // ChoCh heuristic: initial sequence opposite then break in desired direction
            const firstMoves = closesL.slice(0, 3).map((v: number, i: number)=> i>0 ? v - closesL[i-1] : 0);
            const initialOpposite = type === 'bull' ? (firstMoves[1] < 0) : (firstMoves[1] > 0);
            const choch = initialOpposite && bos;
            // SFP on LTF against the pre-range extremes
            const tol = baseATR * 0.1;
            let sfp = false;
            for (let i = 2; i < subset.length; i++) {
              if (type === 'bear' && highsL[i] > preRangeHigh + tol && closesL[i] < preRangeHigh) { sfp = true; break; }
              if (type === 'bull' && lowsL[i] < preRangeLow - tol && closesL[i] > preRangeLow) { sfp = true; break; }
            }
            // FVG mitigation on LTF (gap filled within window)
            let fvgMitigation = false;
            for (let i = 2; i < subset.length; i++) {
              const bullGap = lowsL[i] > highsL[i-2];
              const bearGap = highsL[i] < lowsL[i-2];
              if (bullGap || bearGap) {
                // Check next candles overlap prior extremes
                const filled = (i+1 < subset.length) && (lowsL[i+1] <= highsL[i-2] || highsL[i+1] >= lowsL[i-2]);
                if (filled) { fvgMitigation = true; break; }
              }
            }
            return { bos, choch, sfp, fvgMitigation };
          } catch { return { bos: false, choch: false, sfp: false, fvgMitigation: false }; }
        };

        for (let i = 0; i < hiddenOrderBlocks.length; i++) {
          const hob: any = hiddenOrderBlocks[i];
          const zoneMid = (hob.zone.open + hob.zone.close) / 2;
          // Fully mitigated/invalidated after revisit
          let invalidated = false; let fullyMitigated = false;
          for (let j = hob.revisitIdx + 1; j < candles.length; j++) {
            if (hob.type === 'bull') { if (closes[j] < Math.min(hob.zone.open, hob.zone.close)) { invalidated = true; break; } }
            else { if (closes[j] > Math.max(hob.zone.open, hob.zone.close)) { invalidated = true; break; } }
            // Full body close well away from core implies mitigation
            const bodyLow = Math.min(opens[j], closes[j]); const bodyHigh = Math.max(opens[j], closes[j]);
            if (hob.type === 'bull' && bodyLow > Math.max(hob.zone.open, hob.zone.close)) { fullyMitigated = true; }
            if (hob.type === 'bear' && bodyHigh < Math.min(hob.zone.open, hob.zone.close)) { fullyMitigated = true; }
          }
          // LTF confirmations
          const ltf = await computeLtfConfirmations(timestamps[hob.revisitIdx], hob.type);
          // Components for scoring
          const windowN = Math.min(5, closes.length - 1 - hob.idx);
          const disp = windowN > 0 ? Math.abs(closes[hob.idx + windowN] - closes[hob.idx]) / baseATR : 0;
          const dispScore = Math.min(1, disp / 2);
          const rvIdx = hob.revisitIdx;
          const wickRatio = hob.type === 'bull' ? Math.max(0, Math.min(1, (Math.min(hob.zone.open, hob.zone.close) - lows[rvIdx]) / Math.max(1e-8, highs[rvIdx] - lows[rvIdx]))) : Math.max(0, Math.min(1, (highs[rvIdx] - Math.max(hob.zone.open, hob.zone.close)) / Math.max(1e-8, highs[rvIdx] - lows[rvIdx])));
          const fvgNear = nearFvg(hob.type, hob.idx) ? 1 : 0;
          const liqScore = nearestLiquidityScore(hob.type, zoneMid);
          const vwapConf = vwapConfluence(zoneMid) ? 1 : 0;
          const hvnConf = hvnConfluence(hob.idx) ? 1 : 0;
          const tfWeight = tfWeightMap[interval] ?? 1.0;
          const qualityScore = (
            0.35 * dispScore +
            0.15 * wickRatio +
            0.15 * fvgNear +
            0.15 * liqScore +
            0.1  * vwapConf +
            0.1  * hvnConf
          ) * tfWeight;
          const confCount = (ltf.bos?1:0) + (ltf.choch?1:0) + (ltf.sfp?1:0) + (ltf.fvgMitigation?1:0);
          const confConfluence = (vwapConf?1:0) + (hvnConf?1:0) + ((liqScore >= 0.5)?1:0) + ((fvgNear?1:0));
          const isVeryStrong = !invalidated && (qualityScore >= veryStrongMinQuality) && (tfWeight >= 1.3) && (confCount >= 2) && (confConfluence >= 2);
          const veryStrongReasons: string[] = [];
          if (qualityScore >= veryStrongMinQuality) veryStrongReasons.push('quality>=threshold');
          if (tfWeight >= 1.3) veryStrongReasons.push('htf_weight_high');
          if (ltf.bos) veryStrongReasons.push('ltf_bos');
          if (ltf.choch) veryStrongReasons.push('ltf_choch');
          if (ltf.sfp) veryStrongReasons.push('ltf_sfp');
          if (ltf.fvgMitigation) veryStrongReasons.push('ltf_fvg_mitigation');
          if (vwapConf) veryStrongReasons.push('vwap_confluence');
          if (hvnConf) veryStrongReasons.push('hvn_confluence');
          if (liqScore >= 0.5) veryStrongReasons.push('near_liquidity');
          if (fvgNear) veryStrongReasons.push('fvg_near');
          if (fullyMitigated) veryStrongReasons.push('fully_mitigated');
          hob.invalidated = invalidated;
          hob.fullyMitigated = fullyMitigated && !invalidated;
          hob.ltfConfirmations = ltf;
          hob.qualityScore = Number(qualityScore.toFixed(3));
          hob.components = { dispScore, wickRatio, fvgNear: !!fvgNear, liqScore, vwap: !!vwapConf, hvn: !!hvnConf, tfWeight };
          hob.isVeryStrong = isVeryStrong;
          hob.strengthLabel = isVeryStrong ? 'very-strong' : (hob.qualityScore >= minQuality ? 'strong' : 'normal');
          if (isVeryStrong) hob.veryStrongReasons = veryStrongReasons;
        }

        const filterHob = (hob: any) => {
          const ltfOk = !requireLTFConfirmations || (hob.ltfConfirmations && (hob.ltfConfirmations.bos || hob.ltfConfirmations.choch || hob.ltfConfirmations.sfp || hob.ltfConfirmations.fvgMitigation));
          const qualityOk = typeof hob.qualityScore === 'number' && hob.qualityScore >= minQuality;
          const invalidationOk = !excludeInvalidated || !hob.invalidated;
          const mitigationOk = !onlyFullyMitigated || hob.fullyMitigated;
          const veryStrongOk = !onlyVeryStrong || hob.isVeryStrong === true;
          return ltfOk && qualityOk && invalidationOk && mitigationOk && veryStrongOk;
        };
        const hobFiltered = hiddenOrderBlocks.filter(filterHob);
        const latest = { close: lastClose, high: highs[highs.length-1], low: lows[lows.length-1], ts: timestamps[timestamps.length-1] };
        const snapshot = compact ? { symbol, interval, latest, pivots: pivots.slice(-6), bos, fvg: fvg.slice(-5), trend, sma50, sma200, atr, rsi, orderBlocks, hiddenOrderBlocks: hobFiltered, liquidityZones, vwap, dailyOpen, weeklyOpen, prevDayHigh, prevDayLow, sfp, ...emaValues } : { symbol, interval, candles, pivots, bos, fvg, trend, sma50, sma200, atr, rsi, orderBlocks, hiddenOrderBlocks: hobFiltered, liquidityZones, vwap, dailyOpen, weeklyOpen, prevDayHigh, prevDayLow, sfp, emaValues };
        if (telemetry) {
          try {
            logHOBs(symbol, interval, latest?.close, hobFiltered);
            const numPivotHighs = pivots.filter(p=>p.type==='H').length;
            const numPivotLows = pivots.filter(p=>p.type==='L').length;
            const bullFvgCount = fvg.filter(g=>g.type==='bull').length;
            const bearFvgCount = fvg.filter(g=>g.type==='bear').length;
            const highsClusterCount = Array.isArray(liquidityZones?.highs) ? liquidityZones.highs.length : 0;
            const lowsClusterCount = Array.isArray(liquidityZones?.lows) ? liquidityZones.lows.length : 0;
            const hobCount = hobFiltered.length;
            const veryStrongCount = hobFiltered.filter((h:any)=>h.isVeryStrong).length;
            const avgHobQuality = hobCount ? (hobFiltered.reduce((s:any,h:any)=>s+(h.qualityScore||0),0)/hobCount) : 0;
            const maxHobQuality = hobCount ? Math.max(...hobFiltered.map((h:any)=>h.qualityScore||0)) : 0;
            logSnapshot(symbol, interval, latest?.close, {
              bos,
              trend,
              rsi,
              atr,
              vwapPresent: vwap!=null,
              numPivotHighs,
              numPivotLows,
              bullFvgCount,
              bearFvgCount,
              highsClusterCount,
              lowsClusterCount,
              orderBlocksCount: orderBlocks.length,
              hiddenOrderBlocksCount: hobCount,
              hiddenOrderBlocksVeryStrongCount: veryStrongCount,
              avgHobQuality,
              maxHobQuality,
              sfp,
            });
          } catch {}
        }
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
        interval: { type: 'string', enum: ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','2d','4d','1w','2w'], description: 'Interval to analyze' },
        limit: { type: 'number', description: 'Candles to analyze (default 150)' },
        compact: { type: 'boolean', description: 'Trim results' },
        emas: { type: 'array', items: { type: 'number' }, description: 'EMA periods' },
        atrPeriod: { type: 'number', description: 'ATR period' },
        fvgLookback: { type: 'number', description: 'Bars to scan for FVGs' },
      },
      required: ['symbols','interval']
    },
    handler: async (binanceClient: any, args: unknown) => {
      const { symbols, interval, limit = 150, compact = true, emas = [20,50,200], atrPeriod = 14, fvgLookback = 60, minQuality = 0.6, requireLTFConfirmations = false, excludeInvalidated = true, onlyFullyMitigated = false, telemetry = false } = validateInput(GetMarketSnapshotsSchema, args) as any;
      const normalizeInterval = (iv: string) => (iv === '2d' ? '1d' : iv === '4d' ? '1d' : iv === '2w' ? '1w' : iv);
      const results: any[] = [];
      for (const symbol of symbols) {
        try {
          const klines = await binanceClient.candles({ symbol, interval: normalizeInterval(interval), limit });
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
          if (orderBlocks.length === 0) {
            const windowN = Math.min(5, closes.length - 1);
            const displacementUp = closes[closes.length - 1] - closes[closes.length - 1 - windowN];
            const displacementDown = closes[closes.length - 1 - windowN] - closes[closes.length - 1];
            const base = atr ?? Math.max(1e-8, highs[highs.length - 1] - lows[lows.length - 1]);
            const threshold = base * 0.8;
            if (displacementUp > threshold) { for (let i = candles.length - 2; i >= Math.max(1, candles.length - 1 - lookbackOB); i--) { if (opens[i] > closes[i]) { orderBlocks.push({ type: 'bull', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; } } }
            else if (displacementDown > threshold) { for (let i = candles.length - 2; i >= Math.max(1, candles.length - 1 - lookbackOB); i--) { if (opens[i] < closes[i]) { orderBlocks.push({ type: 'bear', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; } } }
          }
          if (orderBlocks.length === 0) {
            const lastH = [...pivots].reverse().find(p => p.type === 'H');
            const lastL = [...pivots].reverse().find(p => p.type === 'L');
            if (lastH) { for (let i = lastH.idx - 1; i >= Math.max(0, lastH.idx - 10); i--) { if (opens[i] > closes[i]) { orderBlocks.push({ type: 'bull', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; } } }
            if (orderBlocks.length === 0 && lastL) { for (let i = lastL.idx - 1; i >= Math.max(0, lastL.idx - 10); i--) { if (opens[i] < closes[i]) { orderBlocks.push({ type: 'bear', idx: i, open: opens[i], high: highs[i], low: lows[i], close: closes[i] }); break; } } }
          }
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
          // Hidden Order Blocks (mitigation tracker for each detected OB)
          const hiddenOrderBlocks: Array<{ type: 'bull'|'bear'; idx: number; zone: { open: number; close: number; high: number; low: number }; revisitIdx: number; wickThrough: boolean; partialClose: boolean; coreUntouched: boolean }> = [];
          for (const ob of orderBlocks) {
            const bodyLow = Math.min(ob.open, ob.close);
            const bodyHigh = Math.max(ob.open, ob.close);
            let revisitIdx = -1;
            for (let i = ob.idx + 1; i < candles.length; i++) {
              if (highs[i] >= bodyLow && lows[i] <= bodyHigh) { revisitIdx = i; break; }
            }
            if (revisitIdx !== -1) {
              if (ob.type === 'bull') {
                const invalidated = closes[revisitIdx] < bodyLow;
                const wickThrough = lows[revisitIdx] < bodyLow && closes[revisitIdx] >= bodyLow;
                const partialClose = closes[revisitIdx] >= bodyLow && closes[revisitIdx] <= bodyHigh;
                if (!invalidated && (wickThrough || partialClose)) {
                  hiddenOrderBlocks.push({ type: 'bull', idx: ob.idx, zone: { open: ob.open, close: ob.close, high: ob.high, low: ob.low }, revisitIdx, wickThrough, partialClose, coreUntouched: true });
                }
              } else {
                const invalidated = closes[revisitIdx] > bodyHigh;
                const wickThrough = highs[revisitIdx] > bodyHigh && closes[revisitIdx] <= bodyHigh;
                const partialClose = closes[revisitIdx] >= bodyLow && closes[revisitIdx] <= bodyHigh;
                if (!invalidated && (wickThrough || partialClose)) {
                  hiddenOrderBlocks.push({ type: 'bear', idx: ob.idx, zone: { open: ob.open, close: ob.close, high: ob.high, low: ob.low }, revisitIdx, wickThrough, partialClose, coreUntouched: true });
                }
              }
            }
          }
          const filterHob = (hob: any) => {
            const ltfOk = !requireLTFConfirmations || (hob.ltfConfirmations && (hob.ltfConfirmations.bos || hob.ltfConfirmations.choch || hob.ltfConfirmations.sfp || hob.ltfConfirmations.fvgMitigation));
            const qualityOk = typeof hob.qualityScore === 'number' && hob.qualityScore >= minQuality;
            const invalidationOk = !excludeInvalidated || !hob.invalidated;
            const mitigationOk = !onlyFullyMitigated || hob.fullyMitigated;
            return ltfOk && qualityOk && invalidationOk && mitigationOk;
          };
          const hobFiltered = hiddenOrderBlocks.filter(filterHob);
          const latest = { close: lastClose, high: highs[highs.length-1], low: lows[lows.length-1], ts: timestamps[timestamps.length-1] };
          if (telemetry) {
            try {
              logHOBs(symbol, interval, latest?.close, hobFiltered);
              const numPivotHighs = pivots.filter(p=>p.type==='H').length;
              const numPivotLows = pivots.filter(p=>p.type==='L').length;
              const bullFvgCount = fvg.filter(g=>g.type==='bull').length;
              const bearFvgCount = fvg.filter(g=>g.type==='bear').length;
              const highsClusterCount = Array.isArray(liquidityZones?.highs) ? liquidityZones.highs.length : 0;
              const lowsClusterCount = Array.isArray(liquidityZones?.lows) ? liquidityZones.lows.length : 0;
              const hobCount = hobFiltered.length;
              const veryStrongCount = hobFiltered.filter((h:any)=>h.isVeryStrong).length;
              const avgHobQuality = hobCount ? (hobFiltered.reduce((s:any,h:any)=>s+(h.qualityScore||0),0)/hobCount) : 0;
              const maxHobQuality = hobCount ? Math.max(...hobFiltered.map((h:any)=>h.qualityScore||0)) : 0;
              logSnapshot(symbol, interval, latest?.close, {
                bos,
                trend,
                rsi,
                atr,
                vwapPresent: vwap!=null,
                numPivotHighs,
                numPivotLows,
                bullFvgCount,
                bearFvgCount,
                highsClusterCount,
                lowsClusterCount,
                orderBlocksCount: orderBlocks.length,
                hiddenOrderBlocksCount: hobCount,
                hiddenOrderBlocksVeryStrongCount: veryStrongCount,
                avgHobQuality,
                maxHobQuality,
                sfp,
              });
            } catch {}
          }
          results.push(compact ? { symbol, interval, latest, bos, pivots: pivots.slice(-4), trend, sma50, sma200, atr, rsi, orderBlocks, hiddenOrderBlocks: hobFiltered, liquidityZones, vwap, dailyOpen, weeklyOpen, prevDayHigh, prevDayLow, sfp, ...emaValues, fvg: fvg.slice(-3) } : { symbol, interval, candles, bos, pivots, trend, sma50, sma200, atr, rsi, orderBlocks, hiddenOrderBlocks: hobFiltered, liquidityZones, vwap, dailyOpen, weeklyOpen, prevDayHigh, prevDayLow, sfp, emaValues, fvg });
        } catch (error) {
          results.push({ symbol, error: sanitizeError(error as any) });
        }
      }
      return results;
    },
  },
];