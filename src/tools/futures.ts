import {
  GetFuturesAccountInfoSchema,
  GetFuturesPositionsSchema,
  GetFuturesOpenOrdersSchema,
  GetFuturesOrderHistorySchema,
  PlaceFuturesOrderSchema,
  CancelFuturesOrderSchema,
  CancelAllFuturesOrdersSchema,
  SetFuturesLeverageSchema,
  SetFuturesMarginTypeSchema,
  PlaceFuturesStopLossSchema,
  PlaceFuturesTakeProfitSchema,
  PlaceFuturesTrailingStopSchema,
  CloseFuturesPositionSchema,
  ModifyFuturesOrderSchema,
  PlaceFuturesBracketOrderSchema,
  AdjustFuturesIsolatedMarginSchema,
  SetFuturesPositionModeSchema,
  GetFuturesIncomeHistorySchema,
  GetFuturesADLQuantileSchema,
  GetFuturesFundingRateSchema,
  GetFuturesMarkPriceSchema,
  GetFuturesOpenInterestSchema,
  GetFuturesLongShortRatioSchema,
  GetFuturesTakerVolumeSchema,
  GetFuturesBasisSchema,
  PlaceMultipleFuturesOrdersSchema,
  GetFuturesCommissionRateSchema,
  CancelMultipleFuturesOrdersSchema,
} from '../types/mcp.js';
import { validateInput, validateSymbol } from '../utils/validation.js';
import { handleBinanceError } from '../utils/error-handling.js';
import { getNetworkMode, getSafetyConfig } from '../config/binance.js';
import { logTrailingEvent } from '../utils/telemetry.js';
import {
  createOrderPreview,
  validateRiskConfirmation,
  formatRiskWarning,
  RiskLevel
} from '../utils/risk-assessment.js';

export const futuresTools = [
  {
    name: 'get_futures_account_info',
    description: 'Obtaineth futures account information and balances',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: async (binanceClient: any, args: unknown) => {
      validateInput(GetFuturesAccountInfoSchema, args);

      try {
        const accountInfo = await binanceClient.futuresAccountInfo();

        return {
          totalWalletBalance: accountInfo.totalWalletBalance,
          totalUnrealizedProfit: accountInfo.totalUnrealizedProfit,
          totalMarginBalance: accountInfo.totalMarginBalance,
          totalPositionInitialMargin: accountInfo.totalPositionInitialMargin,
          totalOpenOrderInitialMargin: accountInfo.totalOpenOrderInitialMargin,
          totalCrossWalletBalance: accountInfo.totalCrossWalletBalance,
          totalCrossUnPnl: accountInfo.totalCrossUnPnl,
          availableBalance: accountInfo.availableBalance,
          maxWithdrawAmount: accountInfo.maxWithdrawAmount,
          assets: accountInfo.assets
            .filter((asset: any) => parseFloat(asset.walletBalance) > 0)
            .map((asset: any) => ({
              asset: asset.asset,
              walletBalance: asset.walletBalance,
              unrealizedProfit: asset.unrealizedProfit,
              marginBalance: asset.marginBalance,
              maintMargin: asset.maintMargin,
              initialMargin: asset.initialMargin,
              availableBalance: asset.availableBalance,
              maxWithdrawAmount: asset.maxWithdrawAmount,
            })),
          positions: accountInfo.positions
            .filter((pos: any) => parseFloat(pos.positionAmt) !== 0)
            .map((pos: any) => ({
              symbol: pos.symbol,
              positionAmt: pos.positionAmt,
              entryPrice: pos.entryPrice,
              markPrice: pos.markPrice,
              unRealizedProfit: pos.unRealizedProfit,
              liquidationPrice: pos.liquidationPrice,
              leverage: pos.leverage,
              marginType: pos.marginType,
              isolatedMargin: pos.isolatedMargin,
              positionSide: pos.positionSide,
            })),
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'place_futures_trailing_stop',
    description: 'Placeth a native trailing stop order for futures (TRAILING_STOP_MARKET)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Trading pair symbol' },
        side: { type: 'string', enum: ['BUY','SELL'], description: 'Order side' },
        quantity: { type: 'string', description: 'Order quantity' },
        callbackRate: { type: 'string', description: 'Trailing percent (e.g., 0.5 for 0.5%)' },
        activationPrice: { type: 'string', description: 'Activation price for the trailing stop', nullable: true },
        positionSide: { type: 'string', enum: ['BOTH','LONG','SHORT'], description: 'Position side for hedge mode', nullable: true },
        confirmRisk: { type: 'boolean', description: 'Confirm understanding of trailing stop behavior', nullable: true },
      },
      required: ['symbol','side','quantity','callbackRate'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(PlaceFuturesTrailingStopSchema, args);
      validateSymbol(input.symbol);

      try {
        const params: any = {
          symbol: input.symbol,
          side: input.side,
          type: 'TRAILING_STOP_MARKET',
          quantity: input.quantity,
          callbackRate: input.callbackRate,
        };
        if (input.activationPrice) params.activationPrice = input.activationPrice;
        if (input.positionSide) params.positionSide = input.positionSide;

        const order = await binanceClient.futuresOrder(params);
        try {
          logTrailingEvent(input.symbol, {
            tool: 'place_futures_trailing_stop',
            side: input.side,
            quantity: input.quantity,
            callbackRate: input.callbackRate,
            activationPrice: input.activationPrice,
            positionSide: input.positionSide,
            result: {
              orderId: order.orderId,
              status: order.status,
              type: order.type,
            },
          });
        } catch {}

        return {
          orderId: order.orderId,
          symbol: order.symbol,
          status: order.status,
          clientOrderId: order.clientOrderId,
          type: order.type,
          side: order.side,
          positionSide: order.positionSide,
          updateTime: order.updateTime,
          networkMode: getNetworkMode(),
          timestamp: Date.now(),
          message: '✅ Trailing stop placed',
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_positions',
    description: 'Obtaineth current futures positions and their risk information',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Specific trading pair symbol, or all if none be specified',
        },
      },
      required: [],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesPositionsSchema, args);

      if (input.symbol) {
        validateSymbol(input.symbol);
      }

      try {
        const positions = await binanceClient.futuresPositionRisk(
          input.symbol ? { symbol: input.symbol } : {}
        );

        const openPositions = positions.filter((p: any) => parseFloat(p.positionAmt) !== 0);

        return {
          symbol: input.symbol || 'ALL',
          positions: openPositions.map((pos: any) => ({
            symbol: pos.symbol,
            positionAmt: pos.positionAmt,
            entryPrice: pos.entryPrice,
            markPrice: pos.markPrice,
            unRealizedProfit: pos.unRealizedProfit,
            liquidationPrice: pos.liquidationPrice,
            leverage: pos.leverage,
            maxNotionalValue: pos.maxNotionalValue,
            marginType: pos.marginType,
            isolatedMargin: pos.isolatedMargin,
            isAutoAddMargin: pos.isAutoAddMargin,
            positionSide: pos.positionSide,
            notional: pos.notional,
            isolatedWallet: pos.isolatedWallet,
            updateTime: pos.updateTime,
          })),
          count: openPositions.length,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_open_orders',
    description: 'Obtaineth the current pending futures orders',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Orders pending for a specific trading pair, or all if none be specified',
        },
      },
      required: [],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesOpenOrdersSchema, args);

      if (input.symbol) {
        validateSymbol(input.symbol);
      }

      try {
        const openOrders = await binanceClient.futuresOpenOrders(
          input.symbol ? { symbol: input.symbol } : {}
        );

        return {
          symbol: input.symbol || 'ALL',
          orders: openOrders.map((order: any) => ({
            symbol: order.symbol,
            orderId: order.orderId,
            clientOrderId: order.clientOrderId,
            price: order.price,
            origQty: order.origQty,
            executedQty: order.executedQty,
            cumQuote: order.cumQuote,
            status: order.status,
            timeInForce: order.timeInForce,
            type: order.type,
            side: order.side,
            stopPrice: order.stopPrice,
            time: order.time,
            updateTime: order.updateTime,
            workingType: order.workingType,
            activatePrice: order.activatePrice,
            priceRate: order.priceRate,
            avgPrice: order.avgPrice,
            positionSide: order.positionSide,
            closePosition: order.closePosition,
          })),
          count: openOrders.length,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_order_history',
    description: 'Obtaineth the historical futures order records',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol, as BTCUSDT doth appear',
        },
        limit: {
          type: 'number',
          description: 'Quantity limit, defaulting to five hundred',
          default: 500,
        },
      },
      required: ['symbol'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesOrderHistorySchema, args);
      validateSymbol(input.symbol);

      try {
        const orderHistory = await binanceClient.futuresAllOrders({
          symbol: input.symbol,
          limit: input.limit,
        });

        return {
          symbol: input.symbol,
          orders: orderHistory.map((order: any) => ({
            symbol: order.symbol,
            orderId: order.orderId,
            clientOrderId: order.clientOrderId,
            price: order.price,
            origQty: order.origQty,
            executedQty: order.executedQty,
            cumQuote: order.cumQuote,
            status: order.status,
            timeInForce: order.timeInForce,
            type: order.type,
            side: order.side,
            stopPrice: order.stopPrice,
            time: order.time,
            updateTime: order.updateTime,
            workingType: order.workingType,
            avgPrice: order.avgPrice,
            positionSide: order.positionSide,
            closePosition: order.closePosition,
          })),
          count: orderHistory.length,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'place_futures_order',
    description: 'Placeth a new futures order upon the exchange (⚠️ MAINNET ENABLED - Exercise caution!)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        side: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Order side',
        },
        type: {
          type: 'string',
          enum: ['MARKET', 'LIMIT'],
          description: 'Order type',
        },
        quantity: {
          type: 'string',
          description: 'Order quantity',
        },
        price: {
          type: 'string',
          description: 'Order price (required for LIMIT orders)',
        },
        positionSide: {
          type: 'string',
          enum: ['BOTH', 'LONG', 'SHORT'],
          description: 'Position side for hedge mode',
        },
        confirmRisk: {
          type: 'boolean',
          description: 'Set to true to confirm thou understandest the risks (required for high-risk orders)',
        },
      },
      required: ['symbol', 'side', 'type', 'quantity'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(PlaceFuturesOrderSchema, args);
      validateSymbol(input.symbol);

      if (input.type === 'LIMIT' && !input.price) {
        throw new Error('Price is required for LIMIT orders');
      }

      try {
        // Get account info for risk assessment
        const accountInfo = await binanceClient.futuresAccountInfo();
        const accountBalance = parseFloat(accountInfo.availableBalance);

        // Get current price for risk assessment
        const ticker = await binanceClient.futuresPrices({ symbol: input.symbol });
        const currentPrice = parseFloat(ticker[input.symbol]);

        // Get current positions to check leverage
        const positions = await binanceClient.futuresPositionRisk({ symbol: input.symbol });
        const currentPosition = positions.find((p: any) => p.symbol === input.symbol);
        const leverage = currentPosition ? parseInt(currentPosition.leverage) : 1;

        // Create order preview with risk assessment
        const preview = createOrderPreview({
          symbol: input.symbol,
          side: input.side,
          type: input.type,
          quantity: input.quantity,
          price: input.price,
          currentPrice,
          leverage,
          accountBalance,
          isDefensiveOrder: false, // This is a new position order
        });

        // Validate risk confirmation if required
        validateRiskConfirmation(preview.riskAssessment, input.confirmRisk);

        // Prepare order parameters
        const orderParams: any = {
          symbol: input.symbol,
          side: input.side,
          type: input.type,
          quantity: input.quantity,
        };

        if (input.price) {
          orderParams.price = input.price;
        }

        if (input.positionSide) {
          orderParams.positionSide = input.positionSide;
        }

        if (input.type === 'LIMIT') {
          orderParams.timeInForce = 'GTC';
        }

        // Execute order
        const order = await binanceClient.futuresOrder(orderParams);

        return {
          orderId: order.orderId,
          symbol: order.symbol,
          status: order.status,
          clientOrderId: order.clientOrderId,
          price: order.price,
          avgPrice: order.avgPrice,
          origQty: order.origQty,
          executedQty: order.executedQty,
          cumQuote: order.cumQuote,
          type: order.type,
          side: order.side,
          positionSide: order.positionSide,
          timeInForce: order.timeInForce,
          updateTime: order.updateTime,
          networkMode: getNetworkMode(),
          riskLevel: preview.riskAssessment.level,
          warnings: preview.riskAssessment.warnings,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'cancel_futures_order',
    description: 'Canceleth a futures order by its ID (⚠️ MAINNET ENABLED)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        orderId: {
          type: 'number',
          description: 'Order ID to cancel',
        },
      },
      required: ['symbol', 'orderId'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(CancelFuturesOrderSchema, args);
      validateSymbol(input.symbol);

      try {
        const result = await binanceClient.futuresCancelOrder({
          symbol: input.symbol,
          orderId: input.orderId,
        });

        return {
          orderId: result.orderId,
          symbol: result.symbol,
          status: result.status,
          clientOrderId: result.clientOrderId,
          price: result.price,
          avgPrice: result.avgPrice,
          origQty: result.origQty,
          executedQty: result.executedQty,
          cumQuote: result.cumQuote,
          type: result.type,
          side: result.side,
          networkMode: getNetworkMode(),
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'cancel_all_futures_orders',
    description: 'Canceleth all open futures orders for a symbol (⚠️ MAINNET ENABLED - Use with care!)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        confirmRisk: {
          type: 'boolean',
          description: 'Set to true to confirm cancellation of all orders',
        },
      },
      required: ['symbol'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(CancelAllFuturesOrdersSchema, args);
      validateSymbol(input.symbol);

      // Get open orders count for warning
      const openOrders = await binanceClient.futuresOpenOrders({ symbol: input.symbol });

      if (openOrders.length > 3 && !input.confirmRisk) {
        throw new Error(`⚠️⚠️ WARNING! Thou art about to cancel ${openOrders.length} open orders for ${input.symbol}! Set confirmRisk: true to proceed.`);
      }

      try {
        const result = await binanceClient.futuresCancelAllOpenOrders({
          symbol: input.symbol,
        });

        return {
          symbol: input.symbol,
          cancelledCount: openOrders.length,
          code: result.code || 200,
          msg: result.msg || `All ${openOrders.length} orders cancelled successfully`,
          networkMode: getNetworkMode(),
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'set_futures_leverage',
    description: 'Setteth the leverage for a futures symbol (⚠️ MAINNET ENABLED - High risk!)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        leverage: {
          type: 'number',
          description: 'Leverage multiplier (1-125)',
        },
        confirmRisk: {
          type: 'boolean',
          description: 'Required for leverage > 10x to confirm understanding of liquidation risk',
        },
      },
      required: ['symbol', 'leverage'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(SetFuturesLeverageSchema, args);
      validateSymbol(input.symbol);

      if (input.leverage < 1 || input.leverage > 125) {
        throw new Error('Leverage must be between 1 and 125');
      }

      // HIGH RISK warning for leverage > 10x
      if (input.leverage > 10 && !input.confirmRisk) {
        const riskLevel = input.leverage > 20 ? RiskLevel.CRITICAL : RiskLevel.HIGH;
        throw new Error(formatRiskWarning(riskLevel, `Thou art setting leverage to ${input.leverage}x! Liquidation risk is extreme! Set confirmRisk: true to proceed.`));
      }

      try {
        const result = await binanceClient.futuresLeverage({
          symbol: input.symbol,
          leverage: input.leverage,
        });

        return {
          symbol: result.symbol,
          leverage: result.leverage,
          maxNotionalValue: result.maxNotionalValue,
          networkMode: getNetworkMode(),
          warning: input.leverage > 5 ? `⚠️ High leverage active (${input.leverage}x) - manage thy risk wisely!` : undefined,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'set_futures_margin_type',
    description: 'Setteth the margin type (ISOLATED or CROSSED) for a futures symbol (⚠️ MAINNET ENABLED)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        marginType: {
          type: 'string',
          enum: ['ISOLATED', 'CROSSED'],
          description: 'Margin type',
        },
      },
      required: ['symbol', 'marginType'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(SetFuturesMarginTypeSchema, args);
      validateSymbol(input.symbol);

      try {
        const result = await binanceClient.futuresMarginType({
          symbol: input.symbol,
          marginType: input.marginType,
        });

        return {
          code: result.code || 200,
          msg: result.msg || `Margin type set to ${input.marginType}`,
          symbol: input.symbol,
          marginType: input.marginType,
          networkMode: getNetworkMode(),
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'place_futures_stop_loss',
    description: 'Placeth a stop-loss order to protect thy position from losses (⚠️ MAINNET ENABLED - Defensive order)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        side: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Order side',
        },
        quantity: {
          type: 'string',
          description: 'Order quantity',
        },
        stopPrice: {
          type: 'string',
          description: 'Stop price that triggeth the order',
        },
        price: {
          type: 'string',
          description: 'Limit price for STOP_LIMIT orders',
        },
        type: {
          type: 'string',
          enum: ['STOP_MARKET', 'STOP_LIMIT'],
          description: 'Stop order type',
        },
        positionSide: {
          type: 'string',
          enum: ['BOTH', 'LONG', 'SHORT'],
          description: 'Position side for hedge mode',
        },
        confirmRisk: {
          type: 'boolean',
          description: 'Confirm understanding of stop order behavior',
        },
      },
      required: ['symbol', 'side', 'quantity', 'stopPrice'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(PlaceFuturesStopLossSchema, args);
      validateSymbol(input.symbol);

      try {
        // Get current price for context
        const ticker = await binanceClient.futuresPrices({ symbol: input.symbol });
        const currentPrice = parseFloat(ticker[input.symbol]);

        // Create order preview (defensive order = MEDIUM risk)
        const preview = createOrderPreview({
          symbol: input.symbol,
          side: input.side,
          type: input.type || 'STOP_MARKET',
          quantity: input.quantity,
          price: input.price,
          currentPrice,
          isDefensiveOrder: true, // This is a protective order
        });

        // Validate risk confirmation if needed
        validateRiskConfirmation(preview.riskAssessment, input.confirmRisk);

        // Place the stop-loss order
        const orderParams: any = {
          symbol: input.symbol,
          side: input.side,
          type: input.type || 'STOP_MARKET',
          quantity: input.quantity,
          stopPrice: input.stopPrice,
        };

        if (input.type === 'STOP_LIMIT' && input.price) {
          orderParams.price = input.price;
          orderParams.timeInForce = 'GTC';
        }

        if (input.positionSide) {
          orderParams.positionSide = input.positionSide;
        }

        const order = await binanceClient.futuresOrder(orderParams);

        return {
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          status: order.status,
          quantity: order.origQty,
          stopPrice: order.stopPrice,
          price: order.price,
          positionSide: order.positionSide,
          currentPrice: currentPrice.toString(),
          networkMode: getNetworkMode(),
          riskLevel: preview.riskAssessment.level,
          warnings: preview.riskAssessment.warnings,
          message: '🛡️ Stop-loss order placed successfully to protect thy position!',
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'place_futures_take_profit',
    description: 'Placeth a take-profit order to secure thy gains at target price (⚠️ MAINNET ENABLED - Defensive order)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        side: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Order side',
        },
        quantity: {
          type: 'string',
          description: 'Order quantity',
        },
        stopPrice: {
          type: 'string',
          description: 'Take profit trigger price',
        },
        price: {
          type: 'string',
          description: 'Limit price for TAKE_PROFIT_LIMIT orders',
        },
        type: {
          type: 'string',
          enum: ['TAKE_PROFIT_MARKET', 'TAKE_PROFIT'],
          description: 'Take profit order type',
        },
        positionSide: {
          type: 'string',
          enum: ['BOTH', 'LONG', 'SHORT'],
          description: 'Position side for hedge mode',
        },
      },
      required: ['symbol', 'side', 'quantity', 'stopPrice'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(PlaceFuturesTakeProfitSchema, args);
      validateSymbol(input.symbol);

      try {
        // Get current price for context
        const ticker = await binanceClient.futuresPrices({ symbol: input.symbol });
        const currentPrice = parseFloat(ticker[input.symbol]);

        // Create order preview (defensive order = MEDIUM risk)
        const preview = createOrderPreview({
          symbol: input.symbol,
          side: input.side,
          type: input.type || 'TAKE_PROFIT_MARKET',
          quantity: input.quantity,
          price: input.price,
          currentPrice,
          isDefensiveOrder: true, // This is a protective order
        });

        // Validate risk confirmation if needed
        validateRiskConfirmation(preview.riskAssessment, input.confirmRisk);

        // Place the take-profit order
        const orderParams: any = {
          symbol: input.symbol,
          side: input.side,
          type: input.type || 'TAKE_PROFIT_MARKET',
          quantity: input.quantity,
          stopPrice: input.stopPrice,
        };

        if (input.type === 'TAKE_PROFIT' && input.price) {
          orderParams.price = input.price;
          orderParams.timeInForce = 'GTC';
        }

        if (input.positionSide) {
          orderParams.positionSide = input.positionSide;
        }

        const order = await binanceClient.futuresOrder(orderParams);

        return {
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          status: order.status,
          quantity: order.origQty,
          stopPrice: order.stopPrice,
          price: order.price,
          positionSide: order.positionSide,
          currentPrice: currentPrice.toString(),
          networkMode: getNetworkMode(),
          riskLevel: preview.riskAssessment.level,
          warnings: preview.riskAssessment.warnings,
          message: '💰 Take-profit order placed successfully - thy gains shall be secured!',
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'place_futures_trailing_stop',
    description: 'Placeth a trailing stop order that followeth price movement (⚠️ MAINNET ENABLED - Defensive order)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        side: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Order side',
        },
        quantity: {
          type: 'string',
          description: 'Order quantity',
        },
        callbackRate: {
          type: 'string',
          description: 'Trailing percentage (0.1 = 0.1%)',
        },
        activationPrice: {
          type: 'string',
          description: 'Price at which trailing begins',
        },
        positionSide: {
          type: 'string',
          enum: ['BOTH', 'LONG', 'SHORT'],
          description: 'Position side for hedge mode',
        },
        confirmRisk: {
          type: 'boolean',
          description: 'Confirm understanding of trailing stop',
        },
      },
      required: ['symbol', 'side', 'quantity', 'callbackRate'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(PlaceFuturesTrailingStopSchema, args);
      validateSymbol(input.symbol);

      try {
        // Get current price for context
        const ticker = await binanceClient.futuresPrices({ symbol: input.symbol });
        const currentPrice = parseFloat(ticker[input.symbol]);

        // Create order preview (defensive order = MEDIUM risk)
        const preview = createOrderPreview({
          symbol: input.symbol,
          side: input.side,
          type: 'TRAILING_STOP_MARKET',
          quantity: input.quantity,
          currentPrice,
          isDefensiveOrder: true, // This is a protective order
        });

        // Validate risk confirmation if needed
        validateRiskConfirmation(preview.riskAssessment, input.confirmRisk);

        // Place the trailing stop order
        const orderParams: any = {
          symbol: input.symbol,
          side: input.side,
          type: 'TRAILING_STOP_MARKET',
          quantity: input.quantity,
          callbackRate: input.callbackRate,
        };

        if (input.activationPrice) {
          orderParams.activationPrice = input.activationPrice;
        }

        if (input.positionSide) {
          orderParams.positionSide = input.positionSide;
        }

        const order = await binanceClient.futuresOrder(orderParams);

        return {
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          status: order.status,
          quantity: order.origQty,
          callbackRate: input.callbackRate,
          activationPrice: order.activatePrice || input.activationPrice,
          positionSide: order.positionSide,
          currentPrice: currentPrice.toString(),
          networkMode: getNetworkMode(),
          riskLevel: preview.riskAssessment.level,
          warnings: preview.riskAssessment.warnings,
          message: `📊 Trailing stop order placed! Will trail by ${input.callbackRate}% as price moveth in thy favor`,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'close_futures_position',
    description: 'Closeth an entire futures position at market price (⚠️ MAINNET ENABLED - Requires confirmation)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        positionSide: {
          type: 'string',
          enum: ['BOTH', 'LONG', 'SHORT'],
          description: 'Which position side to close (for hedge mode)',
        },
        confirmRisk: {
          type: 'boolean',
          description: 'Confirm closing entire position at market price',
        },
      },
      required: ['symbol'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(CloseFuturesPositionSchema, args);
      validateSymbol(input.symbol);

      try {
        // Get current position
        const positions = await binanceClient.futuresPositionRisk({ symbol: input.symbol });
        let position = positions[0];

        // If hedge mode, find the specific position side
        if (input.positionSide) {
          position = positions.find((p: any) => p.positionSide === input.positionSide);
        }

        if (!position || parseFloat(position.positionAmt) === 0) {
          throw new Error(`No open position found for ${input.symbol}${input.positionSide ? ` (${input.positionSide})` : ''}`);
        }

        const positionAmt = parseFloat(position.positionAmt);
        const entryPrice = parseFloat(position.entryPrice);
        const leverage = parseInt(position.leverage);

        // Determine closing side (opposite of position direction)
        const closingSide = positionAmt > 0 ? 'SELL' : 'BUY';
        const quantity = Math.abs(positionAmt).toString();

        // Get current price
        const ticker = await binanceClient.futuresPrices({ symbol: input.symbol });
        const currentPrice = parseFloat(ticker[input.symbol]);

        // Calculate estimated PnL
        const pnl = positionAmt > 0
          ? (currentPrice - entryPrice) * Math.abs(positionAmt)
          : (entryPrice - currentPrice) * Math.abs(positionAmt);

        // Create risk assessment - closing position is HIGH risk
        const preview = createOrderPreview({
          symbol: input.symbol,
          side: closingSide,
          type: 'MARKET',
          quantity,
          currentPrice,
          leverage,
          isDefensiveOrder: false, // Closing is still a market order
        });

        // Always require confirmation for position closes
        preview.riskAssessment.requiresConfirmation = true;
        preview.riskAssessment.warnings.push(`⚠️ Closing entire ${positionAmt > 0 ? 'LONG' : 'SHORT'} position of ${Math.abs(positionAmt)} ${input.symbol}`);
        preview.riskAssessment.warnings.push(`💰 Estimated PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);

        validateRiskConfirmation(preview.riskAssessment, input.confirmRisk);

        // Place market order to close position
        const orderParams: any = {
          symbol: input.symbol,
          side: closingSide,
          type: 'MARKET',
          quantity,
        };

        if (input.positionSide) {
          orderParams.positionSide = input.positionSide;
        }

        const order = await binanceClient.futuresOrder(orderParams);

        return {
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          status: order.status,
          quantity: order.origQty,
          closedPositionSide: positionAmt > 0 ? 'LONG' : 'SHORT',
          entryPrice: entryPrice.toString(),
          closePrice: currentPrice.toString(),
          estimatedPnL: pnl.toFixed(2),
          networkMode: getNetworkMode(),
          riskLevel: preview.riskAssessment.level,
          warnings: preview.riskAssessment.warnings,
          message: `✅ Position closed! Estimated PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'modify_futures_order',
    description: 'Modifieth an existing futures order (price and quantity) (⚠️ MAINNET ENABLED)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        orderId: {
          type: 'number',
          description: 'Order ID to modify',
        },
        side: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Order side',
        },
        quantity: {
          type: 'string',
          description: 'New order quantity',
        },
        price: {
          type: 'string',
          description: 'New order price',
        },
      },
      required: ['symbol', 'orderId', 'side', 'quantity', 'price'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(ModifyFuturesOrderSchema, args);
      validateSymbol(input.symbol);

      try {
        // Binance doesn't have direct modify - we cancel and replace
        // First, get the original order details
        const openOrders = await binanceClient.futuresOpenOrders({ symbol: input.symbol });
        const originalOrder = openOrders.find((o: any) => o.orderId === input.orderId);

        if (!originalOrder) {
          throw new Error(`Order ${input.orderId} not found or already filled/canceled`);
        }

        // Cancel the original order
        await binanceClient.futuresCancelOrder({
          symbol: input.symbol,
          orderId: input.orderId,
        });

        // Place new order with updated parameters
        const newOrderParams: any = {
          symbol: input.symbol,
          side: input.side,
          type: originalOrder.type,
          quantity: input.quantity,
          price: input.price,
          timeInForce: originalOrder.timeInForce || 'GTC',
        };

        // Preserve position side if it was set
        if (originalOrder.positionSide && originalOrder.positionSide !== 'BOTH') {
          newOrderParams.positionSide = originalOrder.positionSide;
        }

        // Preserve stop price for stop orders
        if (originalOrder.stopPrice) {
          newOrderParams.stopPrice = originalOrder.stopPrice;
        }

        const newOrder = await binanceClient.futuresOrder(newOrderParams);

        return {
          originalOrderId: input.orderId,
          newOrderId: newOrder.orderId,
          symbol: newOrder.symbol,
          side: newOrder.side,
          type: newOrder.type,
          status: newOrder.status,
          quantity: newOrder.origQty,
          price: newOrder.price,
          positionSide: newOrder.positionSide,
          networkMode: getNetworkMode(),
          message: `✅ Order modified! Original order ${input.orderId} canceled, new order ${newOrder.orderId} placed`,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'place_futures_bracket_order',
    description: 'Placeth a bracket order with entry, stop-loss, and take-profit (⚠️ MAINNET ENABLED - Requires confirmation)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        side: {
          type: 'string',
          enum: ['BUY', 'SELL'],
          description: 'Entry order side',
        },
        quantity: {
          type: 'string',
          description: 'Order quantity',
        },
        entryPrice: {
          type: 'string',
          description: 'Entry price (LIMIT) or omit for MARKET',
        },
        stopLossPrice: {
          type: 'string',
          description: 'Stop loss trigger price',
        },
        takeProfitPrice: {
          type: 'string',
          description: 'Take profit trigger price',
        },
        positionSide: {
          type: 'string',
          enum: ['BOTH', 'LONG', 'SHORT'],
          description: 'Position side for hedge mode',
        },
        confirmRisk: {
          type: 'boolean',
          description: 'Confirm bracket order strategy',
        },
      },
      required: ['symbol', 'side', 'quantity', 'stopLossPrice', 'takeProfitPrice'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(PlaceFuturesBracketOrderSchema, args);
      validateSymbol(input.symbol);

      try {
        // Get current price and account info
        const ticker = await binanceClient.futuresPrices({ symbol: input.symbol });
        const currentPrice = parseFloat(ticker[input.symbol]);
        const accountInfo = await binanceClient.futuresAccountInfo();
        const accountBalance = parseFloat(accountInfo.availableBalance);

        // Get leverage
        const positions = await binanceClient.futuresPositionRisk({ symbol: input.symbol });
        const leverage = positions[0] ? parseInt(positions[0].leverage) : 1;

        // Create risk assessment for entry order
        const preview = createOrderPreview({
          symbol: input.symbol,
          side: input.side,
          type: input.entryPrice ? 'LIMIT' : 'MARKET',
          quantity: input.quantity,
          price: input.entryPrice,
          currentPrice,
          leverage,
          accountBalance,
          isDefensiveOrder: false,
        });

        // Bracket orders are complex - require confirmation
        preview.riskAssessment.requiresConfirmation = true;
        preview.riskAssessment.warnings.push('📋 Bracket order: Entry + Stop-Loss + Take-Profit');
        preview.riskAssessment.warnings.push(`🎯 Entry: ${input.entryPrice || 'MARKET'} | SL: ${input.stopLossPrice} | TP: ${input.takeProfitPrice}`);

        validateRiskConfirmation(preview.riskAssessment, input.confirmRisk);

        // Step 1: Place entry order
        const entryParams: any = {
          symbol: input.symbol,
          side: input.side,
          type: input.entryPrice ? 'LIMIT' : 'MARKET',
          quantity: input.quantity,
        };

        if (input.entryPrice) {
          entryParams.price = input.entryPrice;
          entryParams.timeInForce = 'GTC';
        }

        if (input.positionSide) {
          entryParams.positionSide = input.positionSide;
        }

        const entryOrder = await binanceClient.futuresOrder(entryParams);

        // Step 2: Place stop-loss order (opposite side)
        const slSide = input.side === 'BUY' ? 'SELL' : 'BUY';
        const slParams: any = {
          symbol: input.symbol,
          side: slSide,
          type: 'STOP_MARKET',
          quantity: input.quantity,
          stopPrice: input.stopLossPrice,
        };

        if (input.positionSide) {
          slParams.positionSide = input.positionSide;
        }

        const stopLossOrder = await binanceClient.futuresOrder(slParams);

        // Step 3: Place take-profit order (opposite side)
        const tpParams: any = {
          symbol: input.symbol,
          side: slSide,
          type: 'TAKE_PROFIT_MARKET',
          quantity: input.quantity,
          stopPrice: input.takeProfitPrice,
        };

        if (input.positionSide) {
          tpParams.positionSide = input.positionSide;
        }

        const takeProfitOrder = await binanceClient.futuresOrder(tpParams);

        return {
          entryOrder: {
            orderId: entryOrder.orderId,
            type: entryOrder.type,
            price: entryOrder.price || 'MARKET',
            status: entryOrder.status,
          },
          stopLossOrder: {
            orderId: stopLossOrder.orderId,
            stopPrice: stopLossOrder.stopPrice,
            status: stopLossOrder.status,
          },
          takeProfitOrder: {
            orderId: takeProfitOrder.orderId,
            stopPrice: takeProfitOrder.stopPrice,
            status: takeProfitOrder.status,
          },
          symbol: input.symbol,
          side: input.side,
          quantity: input.quantity,
          networkMode: getNetworkMode(),
          riskLevel: preview.riskAssessment.level,
          warnings: preview.riskAssessment.warnings,
          message: '✅ Bracket order placed successfully! Entry, Stop-Loss, and Take-Profit orders are active.',
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'adjust_futures_isolated_margin',
    description: 'Adjusteth isolated margin for a futures position (⚠️ MAINNET ENABLED - Requires confirmation for removal)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        amount: {
          type: 'string',
          description: 'Margin amount to add (positive) or remove (negative)',
        },
        type: {
          type: 'string',
          enum: ['ADD', 'REMOVE'],
          description: 'Whether to add or remove margin',
        },
        positionSide: {
          type: 'string',
          enum: ['BOTH', 'LONG', 'SHORT'],
          description: 'Position side for hedge mode',
        },
        confirmRisk: {
          type: 'boolean',
          description: 'Confirm margin adjustment (required for REMOVE)',
        },
      },
      required: ['symbol', 'amount', 'type'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(AdjustFuturesIsolatedMarginSchema, args);
      validateSymbol(input.symbol);

      try {
        // Removing margin is HIGH risk - requires confirmation
        if (input.type === 'REMOVE' && !input.confirmRisk) {
          throw new Error(
            formatRiskWarning(
              RiskLevel.HIGH,
              `Removing margin increaseth liquidation risk! Amount: ${input.amount} USDT. Set confirmRisk: true to proceed.`
            )
          );
        }

        // Get current position to show context
        const positions = await binanceClient.futuresPositionRisk({ symbol: input.symbol });
        let position = positions[0];

        if (input.positionSide) {
          position = positions.find((p: any) => p.positionSide === input.positionSide);
        }

        const params: any = {
          symbol: input.symbol,
          amount: input.amount,
          type: input.type === 'ADD' ? 1 : 2, // 1 = ADD, 2 = REMOVE
        };

        if (input.positionSide) {
          params.positionSide = input.positionSide;
        }

        const result = await binanceClient.futuresPositionMargin(params);

        return {
          code: result.code || 200,
          msg: result.msg || `Margin ${input.type.toLowerCase()}ed successfully`,
          amount: input.amount,
          type: input.type,
          symbol: input.symbol,
          positionSide: input.positionSide,
          currentIsolatedMargin: position ? position.isolatedMargin : undefined,
          networkMode: getNetworkMode(),
          warning: input.type === 'REMOVE' ? '⚠️ Removing margin increases liquidation risk!' : undefined,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'set_futures_position_mode',
    description: 'Setteth position mode between Hedge Mode and One-way Mode (⚠️ MAINNET ENABLED - Requires no open positions)',
    inputSchema: {
      type: 'object',
      properties: {
        dualSidePosition: {
          type: 'boolean',
          description: 'true for Hedge Mode, false for One-way Mode',
        },
        confirmRisk: {
          type: 'boolean',
          description: 'Confirm position mode change (requires no open positions)',
        },
      },
      required: ['dualSidePosition'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(SetFuturesPositionModeSchema, args);

      try {
        // Position mode change requires confirmation
        if (!input.confirmRisk) {
          throw new Error(
            formatRiskWarning(
              RiskLevel.MEDIUM,
              `Changing position mode to ${input.dualSidePosition ? 'Hedge Mode' : 'One-way Mode'} requires closing all positions first! Set confirmRisk: true to proceed.`
            )
          );
        }

        const result = await binanceClient.futuresPositionModeChange({
          dualSidePosition: input.dualSidePosition,
        });

        return {
          code: result.code || 200,
          msg: result.msg || 'Position mode changed successfully',
          positionMode: input.dualSidePosition ? 'Hedge Mode' : 'One-way Mode',
          dualSidePosition: input.dualSidePosition,
          networkMode: getNetworkMode(),
          message: input.dualSidePosition
            ? '✅ Hedge Mode enabled - thou canst hold LONG and SHORT positions simultaneously'
            : '✅ One-way Mode enabled - only one position direction at a time',
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_income_history',
    description: 'Obtaineth futures income history (PnL, funding fees, commissions)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        incomeType: {
          type: 'string',
          enum: ['TRANSFER', 'REALIZED_PNL', 'FUNDING_FEE', 'COMMISSION', 'INSURANCE_CLEAR'],
          description: 'Type of income record',
        },
        startTime: {
          type: 'number',
          description: 'Start timestamp in milliseconds',
        },
        endTime: {
          type: 'number',
          description: 'End timestamp in milliseconds',
        },
        limit: {
          type: 'number',
          description: 'Number of records (max 1000)',
        },
      },
      required: [],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesIncomeHistorySchema, args);

      if (input.symbol) {
        validateSymbol(input.symbol);
      }

      try {
        const params: any = {
          limit: input.limit || 100,
        };

        if (input.symbol) params.symbol = input.symbol;
        if (input.incomeType) params.incomeType = input.incomeType;
        if (input.startTime) params.startTime = input.startTime;
        if (input.endTime) params.endTime = input.endTime;

        const incomeHistory = await binanceClient.futuresIncome(params);

        // Calculate totals by type
        const totals: any = {};
        incomeHistory.forEach((record: any) => {
          const type = record.incomeType;
          if (!totals[type]) totals[type] = 0;
          totals[type] += parseFloat(record.income);
        });

        return {
          incomeRecords: incomeHistory.map((record: any) => ({
            symbol: record.symbol,
            incomeType: record.incomeType,
            income: record.income,
            asset: record.asset,
            time: record.time,
            info: record.info,
            tranId: record.tranId,
          })),
          totals,
          count: incomeHistory.length,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_adl_quantile',
    description: 'Obtaineth Auto-Deleveraging (ADL) quantile indicator for positions',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol, or all if none specified',
        },
      },
      required: [],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesADLQuantileSchema, args);

      if (input.symbol) {
        validateSymbol(input.symbol);
      }

      try {
        const params: any = {};
        if (input.symbol) params.symbol = input.symbol;

        const adlQuantile = await binanceClient.futuresAdlQuantile(params);

        return {
          adlQuantile: Array.isArray(adlQuantile) ? adlQuantile : [adlQuantile],
          explanation: 'ADL Quantile ranges 0-4. Higher values = Higher risk of auto-deleveraging. Keep positions in lower quantiles!',
          networkMode: getNetworkMode(),
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_funding_rate',
    description: 'Obtaineth futures funding rate history for perpetual contracts',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        startTime: {
          type: 'number',
          description: 'Start timestamp',
        },
        endTime: {
          type: 'number',
          description: 'End timestamp',
        },
        limit: {
          type: 'number',
          description: 'Number of records',
        },
      },
      required: ['symbol'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesFundingRateSchema, args);
      validateSymbol(input.symbol);

      try {
        const params: any = {
          symbol: input.symbol,
          limit: input.limit || 100,
        };

        if (input.startTime) params.startTime = input.startTime;
        if (input.endTime) params.endTime = input.endTime;

        const fundingRates = await binanceClient.futuresFundingRate(params);

        // Calculate average funding rate
        const avgRate = fundingRates.length > 0
          ? fundingRates.reduce((sum: number, r: any) => sum + parseFloat(r.fundingRate), 0) / fundingRates.length
          : 0;

        return {
          fundingRates: fundingRates.map((rate: any) => ({
            symbol: rate.symbol,
            fundingRate: rate.fundingRate,
            fundingTime: rate.fundingTime,
            markPrice: rate.markPrice,
          })),
          averageFundingRate: avgRate.toFixed(6),
          count: fundingRates.length,
          interpretation: avgRate > 0
            ? 'Positive funding = Longs pay Shorts (bullish sentiment)'
            : 'Negative funding = Shorts pay Longs (bearish sentiment)',
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_mark_price',
    description: 'Obtaineth current mark price and funding rate for futures',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
      },
      required: ['symbol'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesMarkPriceSchema, args);
      validateSymbol(input.symbol);

      try {
        const markPrice = await binanceClient.futuresMarkPrice({ symbol: input.symbol });

        return {
          symbol: markPrice.symbol,
          markPrice: markPrice.markPrice,
          indexPrice: markPrice.indexPrice,
          lastFundingRate: markPrice.lastFundingRate,
          nextFundingTime: markPrice.nextFundingTime,
          time: markPrice.time,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_open_interest',
    description: 'Obtaineth open interest statistics for futures trading',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        period: {
          type: 'string',
          enum: ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'],
          description: 'Time period for open interest data',
        },
        limit: {
          type: 'number',
          description: 'Number of data points',
        },
      },
      required: ['symbol', 'period'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesOpenInterestSchema, args);
      validateSymbol(input.symbol);

      try {
        const openInterest = await binanceClient.futuresOpenInterest({
          symbol: input.symbol,
          period: input.period,
          limit: input.limit || 30,
        });

        return {
          openInterestData: openInterest,
          symbol: input.symbol,
          period: input.period,
          count: openInterest.length,
          interpretation: 'Increasing open interest + rising price = Strong bullish trend. Decreasing open interest = Weakening trend.',
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_long_short_ratio',
    description: 'Obtaineth long/short ratio by accounts for market sentiment',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        period: {
          type: 'string',
          enum: ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'],
          description: 'Time period',
        },
        limit: {
          type: 'number',
          description: 'Number of data points',
        },
      },
      required: ['symbol', 'period'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesLongShortRatioSchema, args);
      validateSymbol(input.symbol);

      try {
        const ratio = await binanceClient.futuresGlobalLongShortAccountRatio({
          symbol: input.symbol,
          period: input.period,
          limit: input.limit || 30,
        });

        // Calculate average ratio
        const avgRatio = ratio.length > 0
          ? ratio.reduce((sum: number, r: any) => sum + parseFloat(r.longShortRatio), 0) / ratio.length
          : 0;

        return {
          longShortRatioData: ratio,
          averageRatio: avgRatio.toFixed(3),
          symbol: input.symbol,
          period: input.period,
          count: ratio.length,
          interpretation: avgRatio > 1
            ? `Bullish sentiment (${avgRatio.toFixed(2)}:1 Long/Short) - More traders are long`
            : `Bearish sentiment (${avgRatio.toFixed(2)}:1 Long/Short) - More traders are short`,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_taker_volume',
    description: 'Obtaineth taker buy/sell volume ratio for market pressure analysis',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        period: {
          type: 'string',
          enum: ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'],
          description: 'Time period',
        },
        limit: {
          type: 'number',
          description: 'Number of data points',
        },
      },
      required: ['symbol', 'period'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesTakerVolumeSchema, args);
      validateSymbol(input.symbol);

      try {
        const takerVolume = await binanceClient.futuresTakerBuySellVolume({
          symbol: input.symbol,
          period: input.period,
          limit: input.limit || 30,
        });

        return {
          takerVolumeData: takerVolume,
          symbol: input.symbol,
          period: input.period,
          count: takerVolume.length,
          interpretation: 'Buy/Sell ratio > 1 = Buying pressure (bullish). Ratio < 1 = Selling pressure (bearish)',
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_basis',
    description: 'Obtaineth basis (premium/discount) between futures and spot prices',
    inputSchema: {
      type: 'object',
      properties: {
        pair: {
          type: 'string',
          description: 'Trading pair (e.g., BTCUSDT)',
        },
        contractType: {
          type: 'string',
          enum: ['CURRENT_QUARTER', 'NEXT_QUARTER', 'PERPETUAL'],
          description: 'Contract type',
        },
        period: {
          type: 'string',
          enum: ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'],
          description: 'Time period',
        },
        limit: {
          type: 'number',
          description: 'Number of data points',
        },
      },
      required: ['pair', 'contractType', 'period'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesBasisSchema, args);
      validateSymbol(input.pair);

      try {
        const basis = await binanceClient.futuresBasis({
          pair: input.pair,
          contractType: input.contractType,
          period: input.period,
          limit: input.limit || 30,
        });

        return {
          basisData: basis,
          pair: input.pair,
          contractType: input.contractType,
          period: input.period,
          count: basis.length,
          interpretation: 'Positive basis = Futures trading at premium (bullish). Negative basis = Discount (bearish).',
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'place_multiple_futures_orders',
    description: 'Placeth multiple futures orders in a single batch (max 5) (⚠️ MAINNET ENABLED - Requires confirmation)',
    inputSchema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          description: 'Array of orders to place (max 5)',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              side: { type: 'string', enum: ['BUY', 'SELL'] },
              type: { type: 'string', enum: ['MARKET', 'LIMIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'] },
              quantity: { type: 'string' },
              price: { type: 'string' },
              stopPrice: { type: 'string' },
              positionSide: { type: 'string', enum: ['BOTH', 'LONG', 'SHORT'] },
            },
            required: ['symbol', 'side', 'type', 'quantity'],
          },
        },
        confirmRisk: {
          type: 'boolean',
          description: 'Confirm batch order placement',
        },
      },
      required: ['orders'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(PlaceMultipleFuturesOrdersSchema, args);

      if (input.orders.length > 5) {
        throw new Error('Maximum 5 orders per batch allowed');
      }

      if (!input.confirmRisk) {
        throw new Error(
          formatRiskWarning(
            RiskLevel.HIGH,
            `Thou art placing ${input.orders.length} orders simultaneously! Set confirmRisk: true to proceed.`
          )
        );
      }

      try {
        const results = [];
        const errors = [];

        for (const order of input.orders) {
          try {
            validateSymbol(order.symbol);

            const orderParams: any = {
              symbol: order.symbol,
              side: order.side,
              type: order.type,
              quantity: order.quantity,
            };

            if (order.price) orderParams.price = order.price;
            if (order.stopPrice) orderParams.stopPrice = order.stopPrice;
            if (order.positionSide) orderParams.positionSide = order.positionSide;

            if (order.type === 'LIMIT') {
              orderParams.timeInForce = 'GTC';
            }

            const result = await binanceClient.futuresOrder(orderParams);
            results.push({
              success: true,
              orderId: result.orderId,
              symbol: result.symbol,
              side: result.side,
              type: result.type,
              status: result.status,
            });
          } catch (error: any) {
            errors.push({
              success: false,
              symbol: order.symbol,
              error: error.message,
            });
          }
        }

        return {
          totalOrders: input.orders.length,
          successCount: results.length,
          errorCount: errors.length,
          results,
          errors,
          networkMode: getNetworkMode(),
          message: `✅ Batch complete: ${results.length} successful, ${errors.length} failed`,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'get_futures_commission_rate',
    description: 'Obtaineth current futures trading commission rate for a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
      },
      required: ['symbol'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(GetFuturesCommissionRateSchema, args);
      validateSymbol(input.symbol);

      try {
        const commissionRate = await binanceClient.futuresCommissionRate({
          symbol: input.symbol,
        });

        return {
          symbol: commissionRate.symbol,
          makerCommissionRate: commissionRate.makerCommissionRate,
          takerCommissionRate: commissionRate.takerCommissionRate,
          makerCommissionPercent: (parseFloat(commissionRate.makerCommissionRate) * 100).toFixed(4) + '%',
          takerCommissionPercent: (parseFloat(commissionRate.takerCommissionRate) * 100).toFixed(4) + '%',
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },

  {
    name: 'cancel_multiple_futures_orders',
    description: 'Canceleth multiple futures orders by ID (max 10) (⚠️ MAINNET ENABLED)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading pair symbol',
        },
        orderIdList: {
          type: 'array',
          description: 'List of order IDs to cancel (max 10)',
          items: { type: 'number' },
        },
      },
      required: ['symbol', 'orderIdList'],
    },
    handler: async (binanceClient: any, args: unknown) => {
      const input = validateInput(CancelMultipleFuturesOrdersSchema, args);
      validateSymbol(input.symbol);

      if (input.orderIdList.length > 10) {
        throw new Error('Maximum 10 orders per batch allowed');
      }

      try {
        const results = [];
        const errors = [];

        for (const orderId of input.orderIdList) {
          try {
            const result = await binanceClient.futuresCancelOrder({
              symbol: input.symbol,
              orderId,
            });

            results.push({
              success: true,
              orderId: result.orderId,
              symbol: result.symbol,
              status: result.status,
            });
          } catch (error: any) {
            errors.push({
              success: false,
              orderId,
              error: error.message,
            });
          }
        }

        return {
          symbol: input.symbol,
          totalOrders: input.orderIdList.length,
          canceledCount: results.length,
          errorCount: errors.length,
          results,
          errors,
          networkMode: getNetworkMode(),
          message: `✅ Batch cancel complete: ${results.length} canceled, ${errors.length} failed`,
          timestamp: Date.now(),
        };
      } catch (error) {
        handleBinanceError(error);
      }
    },
  },
];
