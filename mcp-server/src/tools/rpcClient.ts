/**
 * Lightweight RPC Client for MCP Server
 * 
 * Direct JSON-RPC calls to blockchain nodes without the full OpenScan dependency.
 * This allows the MCP server to be deployed independently.
 */

import { resolveNetworkConfig, type BridgeNetworkConfig } from "../adapters/dataServiceBridge.js";

/**
 * JSON-RPC request structure
 */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

/**
 * JSON-RPC response structure
 */
interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * RPC call options
 */
interface RpcCallOptions {
  timeout?: number;
}

let requestId = 0;

/**
 * Make a JSON-RPC call to a blockchain node
 */
async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[] = [],
  options: RpcCallOptions = {}
): Promise<T> {
  const { timeout = 30000 } = options;

  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: ++requestId,
    method,
    params,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`RPC request failed with status ${response.status}`);
    }

    const json = (await response.json()) as JsonRpcResponse<T>;

    if (json.error) {
      throw new Error(`RPC error: ${json.error.message} (code: ${json.error.code})`);
    }

    return json.result as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`RPC request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * RPC Client for a specific network
 */
export class RpcClient {
  private config: BridgeNetworkConfig;

  constructor(networkIdentifier: string) {
    const config = resolveNetworkConfig(networkIdentifier);
    if (!config) {
      throw new Error(`Unsupported network: ${networkIdentifier}`);
    }
    this.config = config;
  }

  get chainId(): number {
    return this.config.chainId;
  }

  get networkName(): string {
    return this.config.name;
  }

  /**
   * Get the latest block number
   */
  async getBlockNumber(): Promise<number> {
    const result = await rpcCall<string>(this.config.rpcUrl, "eth_blockNumber");
    return parseInt(result, 16);
  }

  /**
   * Get block by number or tag
   */
  async getBlock(blockNumberOrTag: number | string, includeTransactions = false): Promise<Block | null> {
    const blockParam = typeof blockNumberOrTag === "number" 
      ? `0x${blockNumberOrTag.toString(16)}`
      : blockNumberOrTag;

    const result = await rpcCall<Block | null>(
      this.config.rpcUrl,
      "eth_getBlockByNumber",
      [blockParam, includeTransactions]
    );
    return result;
  }

  /**
   * Get block by hash
   */
  async getBlockByHash(blockHash: string, includeTransactions = false): Promise<Block | null> {
    const result = await rpcCall<Block | null>(
      this.config.rpcUrl,
      "eth_getBlockByHash",
      [blockHash, includeTransactions]
    );
    return result;
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash: string): Promise<Transaction | null> {
    const result = await rpcCall<Transaction | null>(
      this.config.rpcUrl,
      "eth_getTransactionByHash",
      [txHash]
    );
    return result;
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    const result = await rpcCall<TransactionReceipt | null>(
      this.config.rpcUrl,
      "eth_getTransactionReceipt",
      [txHash]
    );
    return result;
  }

  /**
   * Get address balance
   */
  async getBalance(address: string, blockTag = "latest"): Promise<string> {
    const result = await rpcCall<string>(
      this.config.rpcUrl,
      "eth_getBalance",
      [address, blockTag]
    );
    return result;
  }

  /**
   * Get address transaction count (nonce)
   */
  async getTransactionCount(address: string, blockTag = "latest"): Promise<number> {
    const result = await rpcCall<string>(
      this.config.rpcUrl,
      "eth_getTransactionCount",
      [address, blockTag]
    );
    return parseInt(result, 16);
  }

  /**
   * Get contract code
   */
  async getCode(address: string, blockTag = "latest"): Promise<string> {
    const result = await rpcCall<string>(
      this.config.rpcUrl,
      "eth_getCode",
      [address, blockTag]
    );
    return result;
  }

  /**
   * Execute a call (read-only)
   */
  async call(
    to: string,
    data: string,
    from?: string,
    value?: string,
    blockTag = "latest"
  ): Promise<string> {
    const callObject: Record<string, string> = { to, data };
    if (from) callObject.from = from;
    if (value) callObject.value = value;

    const result = await rpcCall<string>(
      this.config.rpcUrl,
      "eth_call",
      [callObject, blockTag]
    );
    return result;
  }

  /**
   * Get gas price
   */
  async getGasPrice(): Promise<string> {
    const result = await rpcCall<string>(this.config.rpcUrl, "eth_gasPrice");
    return result;
  }

  /**
   * Get fee history (EIP-1559)
   */
  async getFeeHistory(
    blockCount: number,
    newestBlock: string | number = "latest",
    rewardPercentiles: number[] = [25, 50, 75]
  ): Promise<FeeHistory | null> {
    const blockCountHex = `0x${blockCount.toString(16)}`;
    const blockParam = typeof newestBlock === "number"
      ? `0x${newestBlock.toString(16)}`
      : newestBlock;

    try {
      const result = await rpcCall<FeeHistory>(
        this.config.rpcUrl,
        "eth_feeHistory",
        [blockCountHex, blockParam, rewardPercentiles]
      );
      return result;
    } catch {
      return null; // Not all networks support EIP-1559
    }
  }

  /**
   * Debug trace transaction (requires archive/debug node)
   */
  async traceTransaction(txHash: string, tracerType: "call" | "prestate" = "call"): Promise<unknown | null> {
    try {
      const tracer = tracerType === "call" ? "callTracer" : "prestateTracer";
      const result = await rpcCall<unknown>(
        this.config.rpcUrl,
        "debug_traceTransaction",
        [txHash, { tracer }]
      );
      return result;
    } catch {
      return null; // Trace not available
    }
  }
}

// ============== Types ==============

export interface Block {
  number: string;
  hash: string;
  parentHash: string;
  nonce: string;
  sha3Uncles: string;
  logsBloom: string;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  miner: string;
  difficulty: string;
  totalDifficulty: string;
  extraData: string;
  size: string;
  gasLimit: string;
  gasUsed: string;
  timestamp: string;
  transactions: string[] | Transaction[];
  uncles: string[];
  baseFeePerGas?: string;
}

export interface Transaction {
  hash: string;
  nonce: string;
  blockHash: string | null;
  blockNumber: string | null;
  transactionIndex: string | null;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gas: string;
  input: string;
  v: string;
  r: string;
  s: string;
  type?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  accessList?: AccessListEntry[];
}

export interface AccessListEntry {
  address: string;
  storageKeys: string[];
}

export interface TransactionReceipt {
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  blockNumber: string;
  from: string;
  to: string | null;
  cumulativeGasUsed: string;
  gasUsed: string;
  contractAddress: string | null;
  logs: Log[];
  logsBloom: string;
  status: string;
  effectiveGasPrice: string;
  type?: string;
}

export interface Log {
  removed: boolean;
  logIndex: string;
  transactionIndex: string;
  transactionHash: string;
  blockHash: string;
  blockNumber: string;
  address: string;
  data: string;
  topics: string[];
}

export interface FeeHistory {
  oldestBlock: string;
  baseFeePerGas: string[];
  gasUsedRatio: number[];
  reward?: string[][];
}

/**
 * Create an RPC client for a network
 */
export function createRpcClient(network: string): RpcClient {
  return new RpcClient(network);
}
