/**
 * x402 Pricing Configuration for OpenScan MCP Tools
 * 
 * Per-request micropayments in USDC on Avalanche C-Chain
 */

export interface ToolPricing {
  /** Price in USDC (human-readable, e.g., "0.001") */
  price: string;
  /** Price in atomic units (6 decimals for USDC) */
  priceAtomic: string;
  /** Tool description for pricing display */
  description: string;
  /** Whether this tool is free (promotional) */
  isFree: boolean;
}

/**
 * USDC on Avalanche C-Chain
 * Contract: 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
 */
export const PAYMENT_CONFIG = {
  network: "avalanche",
  chainId: 43114,
  token: {
    symbol: "USDC",
    address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    decimals: 6,
  },
  /** PayAI / Thirdweb facilitator endpoint */
  facilitatorUrl: "https://x402.org/facilitator",
} as const;

/**
 * Convert human-readable USDC amount to atomic units
 */
export function toAtomicUnits(amount: string): string {
  const [whole, decimal = ""] = amount.split(".");
  const paddedDecimal = decimal.padEnd(6, "0").slice(0, 6);
  return BigInt(whole + paddedDecimal).toString();
}

/**
 * Tool pricing configuration
 * Prices are in USDC (6 decimals on Avalanche)
 */
export const TOOL_PRICING: Record<string, ToolPricing> = {
  // Address Tools
  getAddressInfo: {
    price: "0.001",
    priceAtomic: toAtomicUnits("0.001"),
    description: "Get address balance, transaction count, and type",
    isFree: false,
  },
  getAddressTransactions: {
    price: "0.005",
    priceAtomic: toAtomicUnits("0.005"),
    description: "Get transaction history for an address",
    isFree: false,
  },
  getAddressTokens: {
    price: "0.003",
    priceAtomic: toAtomicUnits("0.003"),
    description: "Get ERC20/ERC721 token balances",
    isFree: false,
  },

  // Transaction Tools
  getTransaction: {
    price: "0.002",
    priceAtomic: toAtomicUnits("0.002"),
    description: "Get transaction details and receipt",
    isFree: false,
  },
  getTransactionTrace: {
    price: "0.01",
    priceAtomic: toAtomicUnits("0.01"),
    description: "Get detailed transaction execution trace",
    isFree: false,
  },

  // Block Tools
  getBlock: {
    price: "0.002",
    priceAtomic: toAtomicUnits("0.002"),
    description: "Get block header and metadata",
    isFree: false,
  },
  getBlockWithTransactions: {
    price: "0.005",
    priceAtomic: toAtomicUnits("0.005"),
    description: "Get block with all transaction details",
    isFree: false,
  },
  getLatestBlocks: {
    price: "0.003",
    priceAtomic: toAtomicUnits("0.003"),
    description: "Get recent blocks",
    isFree: false,
  },

  // Network Tools
  getNetworkStats: {
    price: "0.001",
    priceAtomic: toAtomicUnits("0.001"),
    description: "Get network statistics and gas prices",
    isFree: false,
  },
  getGasPrices: {
    price: "0.001",
    priceAtomic: toAtomicUnits("0.001"),
    description: "Get current gas price tiers",
    isFree: false,
  },

  // Contract Tools
  getContractCode: {
    price: "0.002",
    priceAtomic: toAtomicUnits("0.002"),
    description: "Get contract bytecode",
    isFree: false,
  },
  callContract: {
    price: "0.003",
    priceAtomic: toAtomicUnits("0.003"),
    description: "Execute a read-only contract call",
    isFree: false,
  },

  // Free/Promotional Tools
  listNetworks: {
    price: "0",
    priceAtomic: "0",
    description: "List supported blockchain networks",
    isFree: true,
  },
  getX402Info: {
    price: "0",
    priceAtomic: "0",
    description: "Get x402 payment information and pricing",
    isFree: true,
  },
};

/**
 * Get pricing for a tool
 */
export function getToolPricing(toolName: string): ToolPricing | undefined {
  return TOOL_PRICING[toolName];
}

/**
 * Check if a tool requires payment
 */
export function requiresPayment(toolName: string): boolean {
  const pricing = TOOL_PRICING[toolName];
  return pricing ? !pricing.isFree : true; // Default to paid if not found
}

/**
 * Get x402 payment details for response headers
 */
export function getPaymentDetails(toolName: string) {
  const pricing = getToolPricing(toolName);
  if (!pricing || pricing.isFree) {
    return null;
  }

  return {
    "x-payment-required": "true",
    "x-payment-amount": pricing.priceAtomic,
    "x-payment-token": PAYMENT_CONFIG.token.address,
    "x-payment-network": PAYMENT_CONFIG.chainId.toString(),
    "x-payment-facilitator": PAYMENT_CONFIG.facilitatorUrl,
  };
}
