# AI Agent Integration Guide

This guide explains how to integrate the OpenScan MCP server with your AI agent for blockchain data access with x402 payments.

## Prerequisites

1. An AI agent with MCP support (Claude, GPT-4, custom agent)
2. Agent wallet with USDC on Avalanche C-Chain
3. x402 payment signing capability

## Quick Start

### 1. Configure MCP Server

Add OpenScan to your agent's MCP configuration:

```json
{
  "mcpServers": {
    "openscan": {
      "url": "https://openscan.io/api/mcp",
      "transport": "http",
      "payment": {
        "protocol": "x402",
        "network": "avalanche",
        "chainId": 43114,
        "token": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
      }
    }
  }
}
```

### 2. Fund Agent Wallet

Transfer USDC to your agent's Avalanche wallet. Even small amounts work due to micropayment pricing:

- $1 USDC = ~1000 `getAddressInfo` calls
- $1 USDC = ~500 `getTransaction` calls
- $1 USDC = ~100 `getTransactionTrace` calls

### 3. Start Making Calls

Your agent can now use blockchain explorer tools:

```
Agent: What is the balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?

[Agent calls getAddressInfo tool]
[x402 payment processed: $0.001 USDC]

Response: The address has 1,234.56 ETH and 5,678 transactions...
```

## Supported Tools

### Information Tools (Low Cost)

| Tool | Cost | Use Case |
|------|------|----------|
| `getAddressInfo` | $0.001 | Check balances, detect contracts |
| `getNetworkStats` | $0.001 | Monitor chain status |
| `getGasPrices` | $0.001 | Plan transactions |

### Data Tools (Medium Cost)

| Tool | Cost | Use Case |
|------|------|----------|
| `getTransaction` | $0.002 | Analyze transactions |
| `getBlock` | $0.002 | Block analysis |
| `getContractCode` | $0.002 | Smart contract analysis |

### Heavy Tools (Higher Cost)

| Tool | Cost | Use Case |
|------|------|----------|
| `getAddressTransactions` | $0.005 | Wallet history |
| `getBlockWithTransactions` | $0.005 | Full block data |
| `getTransactionTrace` | $0.01 | Debug/trace execution |

### Free Tools

| Tool | Use Case |
|------|----------|
| `listNetworks` | Discover supported chains |
| `getX402Info` | Check pricing and config |

## Payment Flow

### Automatic Payment (Recommended)

If your agent supports x402, payments are automatic:

1. Agent calls tool
2. Server returns 402 with payment challenge
3. Agent signs payment with wallet
4. Agent retries with `X-Payment` header
5. Server verifies, settles, returns data

### Manual Payment Integration

For custom agents, implement this flow:

```typescript
async function callMcpTool(tool: string, input: object) {
  // First attempt (will get 402 for paid tools)
  const response = await fetch('https://openscan.io/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, input })
  });

  if (response.status === 402) {
    // Get payment challenge
    const { payment } = await response.json();
    
    // Sign payment with agent wallet
    const signedPayment = await signX402Payment(payment, agentWallet);
    
    // Retry with payment
    const paidResponse = await fetch('https://openscan.io/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': `x402 ${signedPayment}`
      },
      body: JSON.stringify({ tool, input })
    });
    
    return paidResponse.json();
  }

  return response.json();
}
```

## Wallet Setup

### Using Thirdweb

```typescript
import { createThirdwebClient, privateKeyToAccount } from "thirdweb";

const client = createThirdwebClient({ clientId: "YOUR_CLIENT_ID" });
const account = privateKeyToAccount({
  client,
  privateKey: process.env.AGENT_PRIVATE_KEY,
});
```

### Using Viem

```typescript
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalanche } from "viem/chains";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const client = createWalletClient({
  account,
  chain: avalanche,
  transport: http(),
});
```

## Example Use Cases

### 1. Wallet Monitor Agent

```
System: You are a wallet monitoring agent.

User: Monitor wallet 0x123...

Agent:
1. [getAddressInfo] → Get current balance: 100 AVAX
2. [getAddressTransactions] → Recent activity: 5 txs in last hour
3. [getNetworkStats] → Current gas: 25 gwei

"The wallet has 100 AVAX and shows increased activity..."
```

### 2. Transaction Analyzer

```
System: You analyze blockchain transactions.

User: Analyze tx 0xabc...

Agent:
1. [getTransaction] → Basic tx data
2. [getTransactionTrace] → Execution trace
3. [getContractCode] → Target contract bytecode

"This transaction called the swap() function on a DEX..."
```

### 3. Multi-Chain Explorer

```
System: You explore multiple blockchains.

User: Compare gas on Ethereum vs Avalanche

Agent:
1. [getGasPrices network=ethereum] → 30 gwei
2. [getGasPrices network=avalanche] → 25 nAVAX

"Ethereum gas is currently 30 gwei (~$2 for swap), 
 Avalanche is 25 nAVAX (~$0.01 for swap)..."
```

## Rate Limits

- Per-wallet: 100 requests/minute
- Per-IP: 1000 requests/minute
- Burst: 20 concurrent requests

## Error Handling

| Error Code | Meaning | Action |
|------------|---------|--------|
| 402 | Payment required | Sign and include payment |
| 400 | Invalid input | Check tool schema |
| 404 | Tool not found | Use `listNetworks` to check |
| 429 | Rate limited | Wait and retry |
| 500 | Server error | Retry with backoff |

## Security Best Practices

1. **Wallet Security**: Never expose agent private keys
2. **Amount Limits**: Set maximum payment per request
3. **Allowlisting**: Only allow specific tools if needed
4. **Monitoring**: Track agent spending

## Support

- Documentation: https://docs.openscan.io/mcp
- x402 Protocol: https://x402.org
- MCP Specification: https://modelcontextprotocol.io
