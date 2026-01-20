import { z } from 'zod';

export const GetPriceSchema = z.object({
  symbol: z.string().describe('Trading pair symbol, as BTCUSDT doth appear'),
});

export const GetOrderBookSchema = z.object({
  symbol: z.string().describe('Trading pair symbol, as BTCUSDT doth appear'),
  limit: z.number().optional().default(100).describe('Depth limit, defaulting to a hundred entries'),
  compact: z.boolean().optional().describe('If true, return trimmed result')
});

export const GetKlinesSchema = z.object({
  symbol: z.string().describe('Trading pair symbol, as BTCUSDT doth appear'),
  interval: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']).describe('The interval of time\'s passage'),
  limit: z.number().optional().default(500).describe('Quantity limit, defaulting to five hundred'),
  compact: z.boolean().optional().describe('If true, return trimmed candles')
});

export const Get24hrTickerSchema = z.object({
  symbol: z.string().optional().describe('Trading pair symbol, or all pairs if none be specified'),
  compact: z.boolean().optional().describe('If true, return selected fields only')
});

// Market Snapshot Schemas (spot)
export const GetMarketSnapshotSchema = z.object({
  symbol: z.string().describe('Trading pair symbol (e.g., BTCUSDT)'),
  interval: z.enum(['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','2d','4d','1w','2w']).describe('Candle interval'),
  limit: z.number().optional().default(150).describe('Candles to analyze (default 150)'),
  compact: z.boolean().optional().default(true).describe('Return trimmed summary (default true)'),
  emas: z.array(z.number()).optional().default([20,50,200]).describe('EMA periods (e.g., [20,50,200])'),
  atrPeriod: z.number().optional().default(14).describe('ATR period (e.g., 14)'),
  fvgLookback: z.number().optional().default(60).describe('Bars to scan for FVGs'),
  minQuality: z.number().optional().default(0.6).describe('Minimum quality score for hidden order blocks'),
  requireLTFConfirmations: z.boolean().optional().default(false).describe('Require LTF confirmations (BOS/ChoCh/SFP/FVG mitigation) for HOBs'),
  excludeInvalidated: z.boolean().optional().default(true).describe('Exclude HOBs marked invalidated'),
  onlyFullyMitigated: z.boolean().optional().default(false).describe('Include only fully mitigated HOBs'),
  veryStrongMinQuality: z.number().optional().default(0.75).describe('Quality threshold to flag very-strong setups'),
  onlyVeryStrong: z.boolean().optional().default(false).describe('Filter to return only very-strong setups')
});

export const GetMarketSnapshotsSchema = z.object({
  symbols: z.array(z.string()).describe('Symbols to analyze'),
  interval: z.enum(['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','2d','4d','1w','2w']).describe('Candle interval'),
  limit: z.number().optional().default(150).describe('Candles to analyze (default 150)'),
  compact: z.boolean().optional().default(true).describe('Return trimmed summary'),
  emas: z.array(z.number()).optional().default([20,50,200]).describe('EMA periods'),
  atrPeriod: z.number().optional().default(14).describe('ATR period'),
  fvgLookback: z.number().optional().default(60).describe('Bars to scan for FVGs'),
  minQuality: z.number().optional().default(0.6).describe('Minimum quality score for hidden order blocks'),
  requireLTFConfirmations: z.boolean().optional().default(false).describe('Require LTF confirmations for HOBs'),
  excludeInvalidated: z.boolean().optional().default(true).describe('Exclude HOBs marked invalidated'),
  onlyFullyMitigated: z.boolean().optional().default(false).describe('Include only fully mitigated HOBs'),
  veryStrongMinQuality: z.number().optional().default(0.75).describe('Quality threshold to flag very-strong setups'),
  onlyVeryStrong: z.boolean().optional().default(false).describe('Filter to return only very-strong setups')
});

export const GetAccountInfoSchema = z.object({});

export const GetOpenOrdersSchema = z.object({
  symbol: z.string().optional().describe('Orders pending for a specific trading pair'),
});

export const GetOrderHistorySchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  limit: z.number().optional().default(500).describe('Quantity limit, defaulting to five hundred'),
});

export const PlaceOrderSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  side: z.enum(['BUY', 'SELL']).describe('Direction of thy trade, to buy or sell'),
  type: z.enum(['MARKET', 'LIMIT']).describe('The manner of order placement'),
  quantity: z.string().describe('The quantity desired'),
  price: z.string().optional().describe('The price, required for LIMIT orders most assuredly'),
});

export const CancelOrderSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  orderId: z.number().describe('The order\'s identification number'),
});

export const CancelAllOrdersSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
});
export const PlaceOCOSchema = z.object({
  symbol: z.string().describe('Trading pair symbol, e.g., RENDERUSDT'),
  side: z.enum(['BUY', 'SELL']).describe('Direction of trade'),
  quantity: z.string().describe('Quantity to trade'),
  abovePrice: z.string().describe('Take-profit price (above current price for SELL)'),
  belowPrice: z.string().describe('Stop-loss limit price'),
  belowStopPrice: z.string().describe('Stop-loss trigger price'),
});

export type PlaceOCOInput = z.infer<typeof PlaceOCOSchema>;

// Futures Schemas
export const GetFuturesAccountInfoSchema = z.object({});

export const GetFuturesPositionsSchema = z.object({
  symbol: z.string().optional().describe('Trading pair symbol for specific position, or all if none be specified'),
});

export const GetFuturesOpenOrdersSchema = z.object({
  symbol: z.string().optional().describe('Orders pending for a specific trading pair'),
});

export const GetFuturesOrderHistorySchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  limit: z.number().optional().default(500).describe('Quantity limit, defaulting to five hundred'),
});

export const PlaceFuturesOrderSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  side: z.enum(['BUY', 'SELL']).describe('Direction of thy trade, to buy or sell'),
  type: z.enum(['MARKET', 'LIMIT']).describe('The manner of order placement'),
  quantity: z.string().describe('The quantity desired'),
  price: z.string().optional().describe('The price, required for LIMIT orders most assuredly'),
  positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional().describe('Position side for hedge mode'),
  confirmRisk: z.boolean().optional().describe('Set to true to confirm thou understandest the risks (required for high-risk orders)'),
});

export const CancelFuturesOrderSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  orderId: z.number().describe('The order\'s identification number'),
});

export const CancelAllFuturesOrdersSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  confirmRisk: z.boolean().optional().describe('Set to true to confirm cancellation of all orders'),
});

export const SetFuturesLeverageSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  leverage: z.number().describe('Leverage multiplier (1-125)'),
  confirmRisk: z.boolean().optional().describe('Required for leverage > 10x to confirm understanding of liquidation risk'),
});

export const SetFuturesMarginTypeSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  marginType: z.enum(['ISOLATED', 'CROSSED']).describe('Margin type for position'),
});

// New Advanced Order Types Schemas
export const PlaceFuturesStopLossSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  side: z.enum(['BUY', 'SELL']).describe('Order side'),
  quantity: z.string().describe('Order quantity'),
  stopPrice: z.string().describe('Stop price that triggeth the order'),
  price: z.string().optional().describe('Limit price for STOP_LIMIT orders'),
  type: z.enum(['STOP_MARKET', 'STOP_LIMIT']).optional().default('STOP_MARKET').describe('Stop order type'),
  positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional().describe('Position side for hedge mode'),
  confirmRisk: z.boolean().optional().describe('Confirm understanding of stop order behavior'),
});

export const PlaceFuturesTakeProfitSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  side: z.enum(['BUY', 'SELL']).describe('Order side'),
  quantity: z.string().describe('Order quantity'),
  stopPrice: z.string().describe('Take profit trigger price'),
  price: z.string().optional().describe('Limit price for TAKE_PROFIT_LIMIT orders'),
  type: z.enum(['TAKE_PROFIT_MARKET', 'TAKE_PROFIT']).optional().default('TAKE_PROFIT_MARKET').describe('Take profit order type'),
  positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional().describe('Position side for hedge mode'),
  confirmRisk: z.boolean().optional().describe('Confirm understanding of take-profit order'),
});

export const PlaceFuturesTrailingStopSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  side: z.enum(['BUY', 'SELL']).describe('Order side'),
  quantity: z.string().describe('Order quantity'),
  callbackRate: z.string().describe('Trailing percentage (0.1 = 0.1%)'),
  activationPrice: z.string().optional().describe('Price at which trailing begins'),
  positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional().describe('Position side for hedge mode'),
  confirmRisk: z.boolean().optional().describe('Confirm understanding of trailing stop'),
});

export const CloseFuturesPositionSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional().describe('Which position side to close (for hedge mode)'),
  confirmRisk: z.boolean().optional().describe('Confirm closing entire position at market price'),
});

export const ModifyFuturesOrderSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  orderId: z.number().describe('Order ID to modify'),
  side: z.enum(['BUY', 'SELL']).describe('Order side'),
  quantity: z.string().describe('New order quantity'),
  price: z.string().describe('New order price'),
});

export const PlaceFuturesBracketOrderSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  side: z.enum(['BUY', 'SELL']).describe('Entry order side'),
  quantity: z.string().describe('Order quantity'),
  entryPrice: z.string().optional().describe('Entry price (LIMIT) or omit for MARKET'),
  stopLossPrice: z.string().describe('Stop loss trigger price'),
  takeProfitPrice: z.string().describe('Take profit trigger price'),
  positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional().describe('Position side for hedge mode'),
  confirmRisk: z.boolean().optional().describe('Confirm bracket order strategy'),
});

// Position & Margin Management Schemas
export const AdjustFuturesIsolatedMarginSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  amount: z.string().describe('Margin amount to add (positive) or remove (negative)'),
  type: z.enum(['ADD', 'REMOVE']).describe('Whether to add or remove margin'),
  positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional().describe('Position side for hedge mode'),
  confirmRisk: z.boolean().optional().describe('Confirm margin adjustment (required for REMOVE)'),
});

export const SetFuturesPositionModeSchema = z.object({
  dualSidePosition: z.boolean().describe('true for Hedge Mode, false for One-way Mode'),
  confirmRisk: z.boolean().optional().describe('Confirm position mode change (requires no open positions)'),
});

export const GetFuturesIncomeHistorySchema = z.object({
  symbol: z.string().optional().describe('Trading pair symbol'),
  incomeType: z.enum(['TRANSFER', 'REALIZED_PNL', 'FUNDING_FEE', 'COMMISSION', 'INSURANCE_CLEAR']).optional().describe('Type of income record'),
  startTime: z.number().optional().describe('Start timestamp in milliseconds'),
  endTime: z.number().optional().describe('End timestamp in milliseconds'),
  limit: z.number().optional().default(100).describe('Number of records (max 1000)'),
});

export const GetFuturesADLQuantileSchema = z.object({
  symbol: z.string().optional().describe('Trading pair symbol, or all if none specified'),
});

// Market Intelligence Schemas
export const GetFuturesFundingRateSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  startTime: z.number().optional().describe('Start timestamp'),
  endTime: z.number().optional().describe('End timestamp'),
  limit: z.number().optional().default(100).describe('Number of records'),
});

export const GetFuturesMarkPriceSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
});

export const GetFuturesOpenInterestSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  period: z.enum(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']).describe('Time period for open interest data'),
  limit: z.number().optional().default(30).describe('Number of data points'),
});

export const GetFuturesLongShortRatioSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  period: z.enum(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']).describe('Time period'),
  limit: z.number().optional().default(30).describe('Number of data points'),
});

export const GetFuturesTakerVolumeSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  period: z.enum(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']).describe('Time period'),
  limit: z.number().optional().default(30).describe('Number of data points'),
});

export const GetFuturesBasisSchema = z.object({
  pair: z.string().describe('Trading pair (e.g., BTCUSDT)'),
  contractType: z.enum(['CURRENT_QUARTER', 'NEXT_QUARTER', 'PERPETUAL']).describe('Contract type'),
  period: z.enum(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']).describe('Time period'),
  limit: z.number().optional().default(30).describe('Number of data points'),
});

// Batch Operations Schemas
export const PlaceMultipleFuturesOrdersSchema = z.object({
  orders: z.array(z.object({
    symbol: z.string(),
    side: z.enum(['BUY', 'SELL']),
    type: z.enum(['MARKET', 'LIMIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET']),
    quantity: z.string(),
    price: z.string().optional(),
    stopPrice: z.string().optional(),
    positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional(),
  })).max(5).describe('Array of orders to place (max 5)'),
  confirmRisk: z.boolean().optional().describe('Confirm batch order placement'),
});

export const GetFuturesCommissionRateSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
});

export const CancelMultipleFuturesOrdersSchema = z.object({
  symbol: z.string().describe('Trading pair symbol'),
  orderIdList: z.array(z.number()).max(10).describe('List of order IDs to cancel (max 10)'),
});

export type GetPriceInput = z.infer<typeof GetPriceSchema>;
export type GetOrderBookInput = z.infer<typeof GetOrderBookSchema>;
export type GetKlinesInput = z.infer<typeof GetKlinesSchema>;
export type Get24hrTickerInput = z.infer<typeof Get24hrTickerSchema>;
export type GetMarketSnapshotInput = z.infer<typeof GetMarketSnapshotSchema>;
export type GetMarketSnapshotsInput = z.infer<typeof GetMarketSnapshotsSchema>;
export type GetAccountInfoInput = z.infer<typeof GetAccountInfoSchema>;
export type GetOpenOrdersInput = z.infer<typeof GetOpenOrdersSchema>;
export type GetOrderHistoryInput = z.infer<typeof GetOrderHistorySchema>;
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;
export type CancelAllOrdersInput = z.infer<typeof CancelAllOrdersSchema>;
export type GetFuturesAccountInfoInput = z.infer<typeof GetFuturesAccountInfoSchema>;
export type GetFuturesPositionsInput = z.infer<typeof GetFuturesPositionsSchema>;
export type GetFuturesOpenOrdersInput = z.infer<typeof GetFuturesOpenOrdersSchema>;
export type GetFuturesOrderHistoryInput = z.infer<typeof GetFuturesOrderHistorySchema>;
export type PlaceFuturesOrderInput = z.infer<typeof PlaceFuturesOrderSchema>;
export type CancelFuturesOrderInput = z.infer<typeof CancelFuturesOrderSchema>;
export type CancelAllFuturesOrdersInput = z.infer<typeof CancelAllFuturesOrdersSchema>;
export type SetFuturesLeverageInput = z.infer<typeof SetFuturesLeverageSchema>;
export type SetFuturesMarginTypeInput = z.infer<typeof SetFuturesMarginTypeSchema>;

// New tool type exports
export type PlaceFuturesStopLossInput = z.infer<typeof PlaceFuturesStopLossSchema>;
export type PlaceFuturesTakeProfitInput = z.infer<typeof PlaceFuturesTakeProfitSchema>;
export type PlaceFuturesTrailingStopInput = z.infer<typeof PlaceFuturesTrailingStopSchema>;
export type CloseFuturesPositionInput = z.infer<typeof CloseFuturesPositionSchema>;
export type ModifyFuturesOrderInput = z.infer<typeof ModifyFuturesOrderSchema>;
export type PlaceFuturesBracketOrderInput = z.infer<typeof PlaceFuturesBracketOrderSchema>;
export type AdjustFuturesIsolatedMarginInput = z.infer<typeof AdjustFuturesIsolatedMarginSchema>;
export type SetFuturesPositionModeInput = z.infer<typeof SetFuturesPositionModeSchema>;
export type GetFuturesIncomeHistoryInput = z.infer<typeof GetFuturesIncomeHistorySchema>;
export type GetFuturesADLQuantileInput = z.infer<typeof GetFuturesADLQuantileSchema>;
export type GetFuturesFundingRateInput = z.infer<typeof GetFuturesFundingRateSchema>;
export type GetFuturesMarkPriceInput = z.infer<typeof GetFuturesMarkPriceSchema>;
export type GetFuturesOpenInterestInput = z.infer<typeof GetFuturesOpenInterestSchema>;
export type GetFuturesLongShortRatioInput = z.infer<typeof GetFuturesLongShortRatioSchema>;
export type GetFuturesTakerVolumeInput = z.infer<typeof GetFuturesTakerVolumeSchema>;
export type GetFuturesBasisInput = z.infer<typeof GetFuturesBasisSchema>;
export type PlaceMultipleFuturesOrdersInput = z.infer<typeof PlaceMultipleFuturesOrdersSchema>;
export type GetFuturesCommissionRateInput = z.infer<typeof GetFuturesCommissionRateSchema>;
export type CancelMultipleFuturesOrdersInput = z.infer<typeof CancelMultipleFuturesOrdersSchema>;
