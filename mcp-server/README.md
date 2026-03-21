# OpenScan MCP Server

A Model Context Protocol (MCP) server that provides blockchain explorer tools to AI agents with x402 payment integration. Agents pay per-request micropayments in USDC on Avalanche C-Chain.

## Overview

This MCP server enables AI agents (like Claude, GPT-4, etc.) to query blockchain data from multiple networks. Tools are priced using the x402 HTTP payment protocol, allowing agents to pay directly from their wallets.

### Supported Networks

- Avalanche C-Chain (primary)
- Ethereum Mainnet
- Base
- Polygon
- Arbitrum
- Optimism

### Payment Configuration

- **Network**: Avalanche C-Chain (43114)
- **Token**: USDC (`0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E`)
- **Facilitator**: Thirdweb / PayAI

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Usage

### Stdio Mode (Local Development)

```bash
npm run start:stdio
```

Configure in your MCP client (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "openscan": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js", "--stdio"]
    }
  }
}
```

### HTTP Mode (Production)

Deploy to Vercel and access via:

```
GET  https://your-domain.com/api/mcp       # Server info & tools
POST https://your-domain.com/api/mcp       # Execute tool
POST https://your-domain.com/api/mcp/tools/getAddressInfo  # Direct tool access
```

## Available Tools

### Free Tools

| Tool | Description |
|------|-------------|
| `listNetworks` | List supported blockchain networks |
| `getX402Info` | Get payment configuration and pricing |

### Paid Tools

| Tool | Price (USDC) | Description |
|------|--------------|-------------|
| `getAddressInfo` | $0.001 | Address balance, nonce, contract status |
| `getAddressTransactions` | $0.005 | Transaction history for address |
| `getAddressTokens` | $0.003 | ERC20/ERC721 token balances |
| `getTransaction` | $0.002 | Transaction details and receipt |
| `getTransactionTrace` | $0.01 | Execution trace (debug) |
| `getBlock` | $0.002 | Block header and metadata |
| `getBlockWithTransactions` | $0.005 | Block with full transaction data |
| `getLatestBlocks` | $0.003 | Recent blocks |
| `getNetworkStats` | $0.001 | Network status and gas prices |
| `getGasPrices` | $0.001 | Gas price tiers |
| `getContractCode` | $0.002 | Contract bytecode |
| `callContract` | $0.003 | Read-only contract call |

## x402 Payment Flow

1. **Agent calls a paid tool without payment**
   - Server returns `402 Payment Required` with payment challenge

2. **Agent prepares payment**
   - Signs x402 payment payload with their wallet
   - Includes payment in `X-Payment` header

3. **Agent retries with payment**
   - Server verifies payment via facilitator
   - Settles payment on Avalanche
   - Returns tool result

### Payment Header Format

```
X-Payment: x402 <base64-encoded-payload>
```

Payload structure:
```json
{
  "payer": "0x...",
  "amount": "1000",
  "token": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  "chainId": 43114,
  "signature": "0x..."
}
```

## Environment Variables

```env
# Required
OPENSCAN_WALLET_ADDRESS=0x...     # Address to receive payments
THIRDWEB_SECRET_KEY=...           # Thirdweb API key

# Optional (defaults provided)
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
ETHEREUM_RPC_URL=https://eth.llamarpc.com
BASE_RPC_URL=https://mainnet.base.org
POLYGON_RPC_URL=https://polygon-rpc.com
```

## Example: Agent Configuration

For AI agents with x402 wallet support:

```json
{
  "mcp_servers": [
    {
      "name": "openscan",
      "url": "https://openscan.io/api/mcp",
      "payment": {
        "enabled": true,
        "network": "avalanche",
        "token": "USDC"
      }
    }
  ]
}
```

## API Examples

### Get Server Info

```bash
curl https://openscan.io/api/mcp
```

### Execute Free Tool

```bash
curl -X POST https://openscan.io/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "listNetworks", "input": {}}'
```

### Execute Paid Tool (with payment)

```bash
curl -X POST https://openscan.io/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-Payment: x402 eyJwYXllciI6IjB4Li4uIiwiYW1vdW50IjoiMTAwMCIsLi4ufQ==" \
  -d '{"tool": "getAddressInfo", "input": {"address": "0x...", "network": "avalanche"}}'
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run in stdio mode
npm run start:stdio
```

## Architecture

```
mcp-server/
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # MCP server configuration
│   ├── tools/                # Tool implementations
│   │   ├── schemas.ts        # Zod input schemas
│   │   ├── handlers.ts       # Tool handlers
│   │   └── rpcClient.ts      # Lightweight RPC client
│   ├── x402/                 # Payment integration
│   │   ├── pricing.ts        # Tool pricing config
│   │   └── facilitator.ts    # Thirdweb integration
│   └── adapters/             # Data service bridge
│       └── dataServiceBridge.ts
└── package.json
```

## License

MIT
