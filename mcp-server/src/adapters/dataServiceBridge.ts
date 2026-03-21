/**
 * DataService Bridge
 * 
 * Connects MCP tools to the existing OpenScan DataService infrastructure.
 * This allows the MCP server to reuse all existing blockchain adapters.
 */

import type { NetworkAdapter } from "../../../src/services/adapters/NetworkAdapter.js";
import type { DataService } from "../../../src/services/DataService.js";

/**
 * Network configuration for the bridge
 */
export interface BridgeNetworkConfig {
  networkId: string;
  chainId: number;
  name: string;
  rpcUrl: string;
}

/**
 * Default supported networks
 */
export const SUPPORTED_NETWORKS: Record<string, BridgeNetworkConfig> = {
  avalanche: {
    networkId: "eip155:43114",
    chainId: 43114,
    name: "Avalanche C-Chain",
    rpcUrl: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
  },
  ethereum: {
    networkId: "eip155:1",
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
  },
  base: {
    networkId: "eip155:8453",
    chainId: 8453,
    name: "Base",
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  },
  polygon: {
    networkId: "eip155:137",
    chainId: 137,
    name: "Polygon",
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
  },
  arbitrum: {
    networkId: "eip155:42161",
    chainId: 42161,
    name: "Arbitrum One",
    rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  },
  optimism: {
    networkId: "eip155:10",
    chainId: 10,
    name: "Optimism",
    rpcUrl: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
  },
};

/**
 * Resolve network from identifier (name, chainId, or networkId)
 */
export function resolveNetworkConfig(identifier: string): BridgeNetworkConfig | null {
  const lower = identifier.toLowerCase();
  
  // Check by name
  if (SUPPORTED_NETWORKS[lower]) {
    return SUPPORTED_NETWORKS[lower];
  }

  // Check by chainId
  const chainId = parseInt(identifier, 10);
  if (!isNaN(chainId)) {
    for (const config of Object.values(SUPPORTED_NETWORKS)) {
      if (config.chainId === chainId) {
        return config;
      }
    }
  }

  // Check by networkId (eip155:chainId format)
  for (const config of Object.values(SUPPORTED_NETWORKS)) {
    if (config.networkId === identifier) {
      return config;
    }
  }

  return null;
}

/**
 * List all supported networks
 */
export function listSupportedNetworks(): BridgeNetworkConfig[] {
  return Object.values(SUPPORTED_NETWORKS);
}

/**
 * DataService Bridge Result
 */
export interface BridgeResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    network: string;
    rpcLatency?: number;
    blockNumber?: number;
  };
}

/**
 * Format address data for MCP response
 */
export function formatAddressResponse(data: {
  address: string;
  balance: string;
  transactionCount: number;
  code?: string;
  isContract: boolean;
}) {
  return {
    address: data.address,
    balance: {
      wei: data.balance,
      ether: formatWeiToEther(data.balance),
    },
    transactionCount: data.transactionCount,
    isContract: data.isContract,
    hasCode: !!data.code && data.code !== "0x",
  };
}

/**
 * Format block data for MCP response
 */
export function formatBlockResponse(block: {
  number: number | string;
  hash: string;
  parentHash: string;
  timestamp: number | string;
  miner?: string;
  gasUsed: string;
  gasLimit: string;
  transactions: string[] | object[];
  baseFeePerGas?: string;
}) {
  return {
    number: typeof block.number === "string" ? parseInt(block.number, 16) : block.number,
    hash: block.hash,
    parentHash: block.parentHash,
    timestamp: typeof block.timestamp === "string" ? parseInt(block.timestamp, 16) : block.timestamp,
    miner: block.miner,
    gasUsed: block.gasUsed,
    gasLimit: block.gasLimit,
    transactionCount: block.transactions.length,
    baseFeePerGas: block.baseFeePerGas,
  };
}

/**
 * Format transaction data for MCP response
 */
export function formatTransactionResponse(tx: {
  hash: string;
  blockHash?: string;
  blockNumber?: number | string;
  from: string;
  to?: string;
  value: string;
  gas: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  input: string;
  nonce: number | string;
  status?: number | string;
  gasUsed?: string;
}) {
  return {
    hash: tx.hash,
    blockHash: tx.blockHash,
    blockNumber: tx.blockNumber 
      ? (typeof tx.blockNumber === "string" ? parseInt(tx.blockNumber, 16) : tx.blockNumber)
      : null,
    from: tx.from,
    to: tx.to || null,
    value: {
      wei: tx.value,
      ether: formatWeiToEther(tx.value),
    },
    gas: tx.gas,
    gasPrice: tx.gasPrice,
    maxFeePerGas: tx.maxFeePerGas,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    input: tx.input,
    inputLength: tx.input.length,
    nonce: typeof tx.nonce === "string" ? parseInt(tx.nonce, 16) : tx.nonce,
    status: tx.status !== undefined 
      ? (typeof tx.status === "string" ? parseInt(tx.status, 16) : tx.status)
      : null,
    gasUsed: tx.gasUsed,
    isContractCreation: !tx.to,
    isContractInteraction: !!tx.to && tx.input !== "0x",
  };
}

/**
 * Convert wei to ether string
 */
function formatWeiToEther(wei: string): string {
  try {
    const weiValue = BigInt(wei);
    const etherValue = Number(weiValue) / 1e18;
    return etherValue.toFixed(18).replace(/\.?0+$/, "");
  } catch {
    return "0";
  }
}
