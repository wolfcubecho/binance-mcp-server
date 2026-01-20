require('dotenv').config();
const Binance = require('binance-api-node').default;
const { marketDataTools } = require('../dist/tools/market-data.js');
const { getBinanceConfig } = require('../dist/config/binance.js');

(async () => {
  try {
    const cfg = getBinanceConfig();
    const client = Binance({
      apiKey: cfg.apiKey,
      apiSecret: cfg.apiSecret,
      httpBase: cfg.sandbox ? 'https://testnet.binance.vision' : 'https://api.binance.com',
      getTime: () => Date.now(),
    });

    const getSnapshot = marketDataTools.find(t => t.name === 'get_market_snapshot');
    if (!getSnapshot) {
      throw new Error('get_market_snapshot tool not found');
    }

    const args = { symbol: 'BTCUSDT', interval: '1h', limit: 150, compact: true };
    const result = await getSnapshot.handler(client, args);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Smoke test failed:', err?.message || err);
    process.exit(1);
  }
})();
