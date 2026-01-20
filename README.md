# Binance MCP Server

[![npm](https://img.shields.io/npm/dt/binance-mcp-server?logo=npm)](https://www.npmjs.com/package/binance-mcp-server)
[![smithery badge](https://smithery.ai/badge/@richardokonicha/binance-mcp-server)](https://smithery.ai/server/@richardokonicha/binance-mcp-server)

> **Multi-language Documentation**
> - [English](README.md) (current)
> - [中文](docs/README_zh.md)
> - [日本語](docs/README_ja.md)

A Model Context Protocol (MCP) server that doth provide Claude Code with Binance exchange API functionality, most wondrous and true.

## Quick Start

### 📹 Video Tutorial

Behold our comprehensive MCP usage tutorial, that thou mayest commence thy journey with great haste:

![MCP Usage Tutorial](docs/mcp-usage-tutorial.gif)


### Installation

```bash
npm install -g binance-mcp-server
```

### Configuration

This MCP server may be employed with various AI tools that doth support the MCP protocol:

[![Claude](https://img.shields.io/badge/Claude-FF6B35?style=for-the-badge&logo=anthropic&logoColor=white)](https://claude.ai)
[![Cursor](https://img.shields.io/badge/Cursor-000000?style=for-the-badge&logo=cursor&logoColor=white)](https://cursor.com)
[![Trae](https://img.shields.io/badge/Trae-00C851?style=for-the-badge&logo=ai&logoColor=white)](https://trae.ai)

#### Option 1: Claude Code (CLI)

**One-Click Setup:**
```bash
claude mcp add binance --env BINANCE_API_KEY=YOUR_API_KEY --env BINANCE_API_SECRET=YOUR_API_SECRET --env BINANCE_TESTNET=false -- npx -y binance-mcp-server
```

**Manual Setup:**

Add unto thy Claude Code MCP settings (`.claude/settings.json` or the like):
```json
{
  "mcpServers": {
    "binance": {
      "command": "npx",
      "args": ["-y", "binance-mcp-server"],
      "env": {
        "BINANCE_API_KEY": "your_api_key",
        "BINANCE_API_SECRET": "your_api_secret",
        "BINANCE_TESTNET": "false"
      }
    }
  }
}
```

#### Option 2: Claude Desktop (GUI)

**Location of thy config file:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**NPM Global Install Method:**
```json
{
  "mcpServers": {
    "binance-mcp-server": {
      "command": "npx",
      "args": ["-y", "binance-mcp-server"],
      "env": {
        "BINANCE_API_KEY": "your_api_key_here",
        "BINANCE_API_SECRET": "your_api_secret_here",
        "BINANCE_TESTNET": "false"
      }
    }
  }
}
```

**Local Development Method:**
```json
{
  "mcpServers": {
    "binance-mcp-server": {
      "command": "node",
      "args": [
        "/absolute/path/to/binance-mcp-server/dist/index.js"
      ],
      "env": {
        "BINANCE_API_KEY": "your_api_key_here",
        "BINANCE_API_SECRET": "your_api_secret_here",
        "BINANCE_TESTNET": "false",
        "MCP_SERVER_NAME": "binance-mcp-server",
        "MCP_SERVER_VERSION": "1.1.1",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

After adding the configuration, proceed thusly:
1. **Save thy config file**
2. **Restart Claude Desktop in its entirety** (Quit and reopen)
3. The MCP server shall load automatically, as if by magic

> **Note**: Set `BINANCE_TESTNET` to `"true"` shouldst thou desire to employ the Binance testnet for development and testing most prudent.


### Environment Setup

#### Obtaining thy API Keys

**For Testnet (Most Recommended for Development):**
1. Venture forth to [Binance Testnet](https://testnet.binance.vision/)
2. Create a testnet account (no true verification be required)
3. Journey to API Management in thy testnet account
4. Forge a new API key with trading permissions most fitting
5. Note: Testnet doth employ virtual funds - completely safe for thy testing endeavors

**For Mainnet (Production, Most Perilous):**
1. Create a verified account upon [Binance](https://www.binance.com/)
2. Complete KYC verification, as the law doth require
3. Journey to API Management in thy account settings
4. Forge a new API key with required permissions
5. ⚠️ **Warning Most Dire: Mainnet doth employ REAL coin - exercise utmost care!**

#### Configuration

Create thy `.env` file thusly:
```env
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
BINANCE_TESTNET=true  # Set to false for mainnet (REAL coin, most perilous!)
```

## Available Tools Most Wondrous

### Market Data (4 tools)
- `get_price` - Obtaineth the current price for a trading pair
- `get_orderbook` - Obtaineth the order book depth data
- `get_klines` - Obtaineth K-line/candlestick data most illuminating
- `get_24hr_ticker` - Obtaineth 24-hour price statistics

### Spot Account (3 tools)
- `get_account_info` - Obtaineth spot account information and balances
- `get_open_orders` - Obtaineth current open spot orders
- `get_order_history` - Obtaineth historical spot orders

### Spot Trading (3 tools - Mainnet & Testnet)
- `place_order` - Placeth a new spot order (supporteth both mainnet and testnet)
- `cancel_order` - Canceleth specific spot order (supporteth both mainnet and testnet)
- `cancel_all_orders` - Canceleth all open spot orders (supporteth both mainnet and testnet)

### Futures Account & Data (10 tools)
- `get_futures_account_info` - Obtaineth futures account balance, margin, and PnL
- `get_futures_positions` - Obtaineth open futures positions with entry price, PnL, leverage
- `get_futures_open_orders` - Obtaineth pending futures orders
- `get_futures_order_history` - Obtaineth historical futures orders
- `get_futures_income_history` - Obtaineth income history (PnL, funding fees, commissions)
- `get_futures_adl_quantile` - Obtaineth Auto-Deleveraging (ADL) quantile indicator
- `get_futures_commission_rate` - Obtaineth current trading commission rates
- `place_futures_order` - Placeth futures market/limit order (⚠️ MAINNET ENABLED with risk warnings)
- `cancel_futures_order` - Canceleth specific futures order (⚠️ MAINNET ENABLED)
- `cancel_all_futures_orders` - Canceleth all futures orders for a symbol (⚠️ MAINNET ENABLED, requires confirmation)

### Advanced Order Types (3 tools)
- `place_futures_stop_loss` - Placeth stop-loss order to protect thy position (⚠️ MAINNET ENABLED - Defensive)
- `place_futures_take_profit` - Placeth take-profit order to secure gains (⚠️ MAINNET ENABLED - Defensive)
- `place_futures_trailing_stop` - Placeth trailing stop that followeth price movement (⚠️ MAINNET ENABLED - Defensive)

### Position Management (7 tools)
- `close_futures_position` - Closeth entire position at market price (⚠️ MAINNET ENABLED, requires confirmation)
- `modify_futures_order` - Modifieth existing order price and quantity (⚠️ MAINNET ENABLED)
- `place_futures_bracket_order` - Placeth entry + stop-loss + take-profit (⚠️ MAINNET ENABLED, requires confirmation)
- `set_futures_leverage` - Adjusteth leverage 1-125x (⚠️ MAINNET ENABLED, high leverage requires confirmation)
- `set_futures_margin_type` - Setteth ISOLATED or CROSSED margin (⚠️ MAINNET ENABLED)
- `adjust_futures_isolated_margin` - Add or remove margin from isolated positions (⚠️ MAINNET ENABLED, removal requires confirmation)
- `set_futures_position_mode` - Switch between Hedge Mode and One-way Mode (⚠️ MAINNET ENABLED, requires confirmation)

### Market Intelligence (6 tools)
- `get_futures_funding_rate` - Obtaineth funding rate history for perpetual contracts
- `get_futures_mark_price` - Obtaineth current mark price and funding rate
- `get_futures_open_interest` - Obtaineth open interest statistics for trend analysis
- `get_futures_long_short_ratio` - Obtaineth long/short ratio for market sentiment
- `get_futures_taker_volume` - Obtaineth taker buy/sell volume for pressure analysis
- `get_futures_basis` - Obtaineth basis (premium/discount) between futures and spot

### Batch Operations (3 tools)
- `place_multiple_futures_orders` - Placeth up to 5 orders simultaneously (⚠️ MAINNET ENABLED, requires confirmation)
- `cancel_multiple_futures_orders` - Canceleth up to 10 orders by ID (⚠️ MAINNET ENABLED)

**Total: 38 tools available for thy trading pleasure**

## Usage Examples Most Instructive

### Market Data Queries
- "Pray tell, what be the current price of Bitcoin?"
- "Show me the order book for ETHUSDT with 20 levels, I beseech thee"
- "Obtaineth 1-hour candlestick data for BTCUSDT"
- "What be the 24-hour trading volume for ETHUSDT?"

### Spot Account Queries
- "Pray check my spot account balance"
- "Show me mine open spot orders"
- "What be my order history for BTCUSDT?"

### Futures Account Queries
- "Show me mine futures account balance"
- "What be mine open futures positions?"
- "Check mine OPENUSDT position details, most urgently"
- "What be my total unrealized PnL?"
- "Show me pending futures orders, if any there be"

### Spot Trading (Employ with caution!)
- "Place a limit buy order for 0.001 BTC at $50,000" (Mainnet/Testnet)
- "Cancel order ID 12345 for BTCUSDT, forthwith" (Mainnet/Testnet)

### Futures Trading (Employ with great caution!)
- "Place a futures market order to buy 100 BTCUSDT" (⚠️ MAINNET ENABLED - risk warnings shown)
- "Set leverage to 10x for ETHUSDT futures" (⚠️ Requires confirmRisk: true for >10x)
- "Place a stop-loss at $95,000 for my BTCUSDT long position"
- "Set a trailing stop with 2% callback for ETHUSDT"
- "Close my entire OPENUSDT position" (⚠️ Requires confirmation)
- "Place a bracket order: entry at $100k, stop-loss $98k, take-profit $105k"
- "Add 500 USDT margin to my BTCUSDT isolated position"
- "Show me the funding rate history for BTCUSDT"
- "What be the long/short ratio for ETHUSDT?"

## Risk Management & Safety

### 🛡️ Intelligent Risk Assessment

This MCP server employeth a sophisticated risk assessment system to protect thy funds:

**Risk Levels:**
- **LOW**: Read-only operations, market data queries
- **MEDIUM**: Defensive orders (stop-loss, take-profit), account modifications
- **HIGH**: New positions, large orders (>50% account balance), high leverage (>10x)
- **CRITICAL**: Extreme leverage (>20x), massive orders (>80% account balance)

**Automatic Protections:**
- Defensive orders (stop-loss, take-profit) = MEDIUM risk, no confirmation needed
- Opening/increasing positions = HIGH risk, requires `confirmRisk: true`
- High leverage (>10x) = Requires explicit confirmation
- Large orders (>50% of account) = Requires explicit confirmation
- All responses include `networkMode` indicator (mainnet/testnet)

### ⚙️ Safety Configuration

Configure thy safety settings in `.env`:

```env
# Safety Configuration
ALLOW_MAINNET_TRADING=true          # Set to false to restrict all trading to testnet
MAX_ORDER_SIZE_PCT=80               # Maximum order size as % of account balance
REQUIRE_CONFIRMATION_ABOVE=50       # Require confirmRisk: true for orders above this %
ENABLE_RISK_WARNINGS=true           # Display risk warnings for all operations
```

### 🔒 Security Best Practices

⚠️ **Of Utmost Importance**:
- Start with `BINANCE_TESTNET=true` for safe testing with virtual funds
- All mainnet trading tools display warnings and require confirmation for high-risk actions
- Defensive orders (stops, take-profits) work seamlessly to protect thy positions
- Set `confirmRisk: true` parameter for high-risk operations
- Use IP whitelisting on thy Binance API keys for additional security
- Never share thy API keys or commit them to version control

## Development

```bash
npm run build    # Compileth TypeScript unto JavaScript
npm run dev      # Development mode, for thy testing
npm run lint     # Runneth linting, to ensure code quality most fine
```

### Hidden Order Blocks (Quality Filters)

The snapshot tools enrich results with `hiddenOrderBlocks` including mitigation flags, LTF confirmations, and a `qualityScore`. You can filter server-side via these inputs:

- Parameters:
  - minQuality: Minimum quality score (default 0.6)
  - requireLTFConfirmations: Require BOS/ChoCh/SFP/FVG mitigation on LTF (default false)
  - excludeInvalidated: Exclude HOBs marked `invalidated` (default true)
  - onlyFullyMitigated: Include only HOBs with `fullyMitigated=true` (default false)

- Example (Claude CLI):
```powershell
claude call get_market_snapshot --args '{
  "symbol":"BTCUSDT","interval":"1h",
  "limit":150,"compact":true,"emas":[20,50,200],"atrPeriod":14,"fvgLookback":60,
  "minQuality":0.7,
  "requireLTFConfirmations":true,
  "excludeInvalidated":true
}'
```

Tip: If new parameters are not visible, restart Claude Desktop or toggle MCP servers to refresh tool schemas.