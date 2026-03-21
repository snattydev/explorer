/**
 * MCP Tool Handlers
 * 
 * Implementation of all blockchain explorer tools for AI agents
 */

import { createRpcClient } from "./rpcClient.js";
import {
  formatAddressResponse,
  formatBlockResponse,
  formatTransactionResponse,
  listSupportedNetworks,
} from "../adapters/dataServiceBridge.js";
import { TOOL_PRICING, PAYMENT_CONFIG } from "../x402/pricing.js";
import type {
  GetAddressInfoInput,
  GetAddressTransactionsInput,
  GetTransactionInput,
  GetTransactionTraceInput,
  GetBlockInput,
  GetBlockWithTransactionsInput,
  GetLatestBlocksInput,
  GetNetworkStatsInput,
  GetGasPricesInput,
  GetContractCodeInput,
  CallContractInput,
} from "./schemas.js";

/**
 * Tool result structure
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    network: string;
    chainId: number;
    tool: string;
    timestamp: number;
  };
}

/**
 * Get address information (balance, nonce, code)
 */
export async function handleGetAddressInfo(
  input: GetAddressInfoInput
): Promise<ToolResult> {
  try {
    const client = createRpcClient(input.network);
    
    const [balance, nonce, code] = await Promise.all([
      client.getBalance(input.address),
      client.getTransactionCount(input.address),
      client.getCode(input.address),
    ]);

    const isContract = code !== "0x" && code.length > 2;

    return {
      success: true,
      data: formatAddressResponse({
        address: input.address,
        balance,
        transactionCount: nonce,
        code: isContract ? code : undefined,
        isContract,
      }),
      metadata: {
        network: client.networkName,
        chainId: client.chainId,
        tool: "getAddressInfo",
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get address info",
    };
  }
}

/**
 * Get transaction details
 */
export async function handleGetTransaction(
  input: GetTransactionInput
): Promise<ToolResult> {
  try {
    const client = createRpcClient(input.network);
    
    const [tx, receipt] = await Promise.all([
      client.getTransaction(input.hash),
      client.getTransactionReceipt(input.hash),
    ]);

    if (!tx) {
      return {
        success: false,
        error: `Transaction not found: ${input.hash}`,
      };
    }

    const formattedTx = formatTransactionResponse({
      ...tx,
      status: receipt?.status,
      gasUsed: receipt?.gasUsed,
    });

    return {
      success: true,
      data: {
        ...formattedTx,
        receipt: receipt ? {
          status: parseInt(receipt.status, 16),
          gasUsed: receipt.gasUsed,
          contractAddress: receipt.contractAddress,
          logsCount: receipt.logs.length,
          effectiveGasPrice: receipt.effectiveGasPrice,
        } : null,
      },
      metadata: {
        network: client.networkName,
        chainId: client.chainId,
        tool: "getTransaction",
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get transaction",
    };
  }
}

/**
 * Get transaction trace
 */
export async function handleGetTransactionTrace(
  input: GetTransactionTraceInput
): Promise<ToolResult> {
  try {
    const client = createRpcClient(input.network);
    
    const tracerType = input.traceType === "prestate" ? "prestate" : "call";
    const trace = await client.traceTransaction(input.hash, tracerType);

    if (!trace) {
      return {
        success: false,
        error: "Transaction trace not available. This network may not support debug methods.",
      };
    }

    return {
      success: true,
      data: {
        hash: input.hash,
        traceType: input.traceType,
        trace,
      },
      metadata: {
        network: client.networkName,
        chainId: client.chainId,
        tool: "getTransactionTrace",
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get transaction trace",
    };
  }
}

/**
 * Get block information
 */
export async function handleGetBlock(
  input: GetBlockInput
): Promise<ToolResult> {
  try {
    const client = createRpcClient(input.network);
    
    let block;
    if (typeof input.block === "string" && input.block.startsWith("0x") && input.block.length === 66) {
      // Block hash
      block = await client.getBlockByHash(input.block, false);
    } else {
      // Block number or tag
      block = await client.getBlock(input.block as number | string, false);
    }

    if (!block) {
      return {
        success: false,
        error: `Block not found: ${input.block}`,
      };
    }

    return {
      success: true,
      data: formatBlockResponse({
        ...block,
        transactions: block.transactions as string[],
      }),
      metadata: {
        network: client.networkName,
        chainId: client.chainId,
        tool: "getBlock",
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get block",
    };
  }
}

/**
 * Get block with full transaction details
 */
export async function handleGetBlockWithTransactions(
  input: GetBlockWithTransactionsInput
): Promise<ToolResult> {
  try {
    const client = createRpcClient(input.network);
    
    let block;
    if (typeof input.block === "string" && input.block.startsWith("0x") && input.block.length === 66) {
      block = await client.getBlockByHash(input.block, true);
    } else {
      block = await client.getBlock(input.block as number | string, true);
    }

    if (!block) {
      return {
        success: false,
        error: `Block not found: ${input.block}`,
      };
    }

    const blockData = formatBlockResponse({
      ...block,
      transactions: block.transactions,
    });

    const transactions = (block.transactions as Array<{
      hash: string;
      from: string;
      to: string | null;
      value: string;
      gas: string;
      gasPrice?: string;
      input: string;
      nonce: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
    }>).map(tx => formatTransactionResponse({
      ...tx,
      blockHash: block.hash,
      blockNumber: block.number,
    }));

    return {
      success: true,
      data: {
        block: blockData,
        transactions,
      },
      metadata: {
        network: client.networkName,
        chainId: client.chainId,
        tool: "getBlockWithTransactions",
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get block with transactions",
    };
  }
}

/**
 * Get latest blocks
 */
export async function handleGetLatestBlocks(
  input: GetLatestBlocksInput
): Promise<ToolResult> {
  try {
    const client = createRpcClient(input.network);
    
    const latestBlockNumber = await client.getBlockNumber();
    const blocks = [];

    for (let i = 0; i < input.count; i++) {
      const blockNumber = latestBlockNumber - i;
      if (blockNumber < 0) break;
      
      const block = await client.getBlock(blockNumber, false);
      if (block) {
        blocks.push(formatBlockResponse({
          ...block,
          transactions: block.transactions as string[],
        }));
      }
    }

    return {
      success: true,
      data: {
        latestBlockNumber,
        blocks,
      },
      metadata: {
        network: client.networkName,
        chainId: client.chainId,
        tool: "getLatestBlocks",
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get latest blocks",
    };
  }
}

/**
 * Get network statistics
 */
export async function handleGetNetworkStats(
  input: GetNetworkStatsInput
): Promise<ToolResult> {
  try {
    const client = createRpcClient(input.network);
    
    const [blockNumber, gasPrice, feeHistory] = await Promise.all([
      client.getBlockNumber(),
      client.getGasPrice(),
      client.getFeeHistory(20, "latest", [25, 50, 75]),
    ]);

    const latestBlock = await client.getBlock(blockNumber, false);

    return {
      success: true,
      data: {
        chainId: client.chainId,
        network: client.networkName,
        latestBlock: blockNumber,
        gasPrice: {
          wei: gasPrice,
          gwei: (parseInt(gasPrice, 16) / 1e9).toFixed(2),
        },
        baseFee: feeHistory?.baseFeePerGas 
          ? {
              wei: feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1],
              gwei: (parseInt(feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1], 16) / 1e9).toFixed(2),
            }
          : null,
        blockTime: latestBlock 
          ? new Date(parseInt(latestBlock.timestamp, 16) * 1000).toISOString()
          : null,
      },
      metadata: {
        network: client.networkName,
        chainId: client.chainId,
        tool: "getNetworkStats",
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get network stats",
    };
  }
}

/**
 * Get gas prices with tiers
 */
export async function handleGetGasPrices(
  input: GetGasPricesInput
): Promise<ToolResult> {
  try {
    const client = createRpcClient(input.network);
    
    const [gasPrice, feeHistory] = await Promise.all([
      client.getGasPrice(),
      client.getFeeHistory(20, "latest", [25, 50, 75]),
    ]);

    let gasTiers;
    if (feeHistory?.reward && feeHistory.reward.length > 0) {
      // Calculate average priority fees
      const avgRewards = [0, 0, 0];
      for (const rewards of feeHistory.reward) {
        if (rewards && rewards.length >= 3) {
          avgRewards[0] += parseInt(rewards[0], 16);
          avgRewards[1] += parseInt(rewards[1], 16);
          avgRewards[2] += parseInt(rewards[2], 16);
        }
      }
      const count = feeHistory.reward.length;
      
      const baseFee = feeHistory.baseFeePerGas
        ? parseInt(feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1], 16)
        : 0;

      gasTiers = {
        low: {
          maxFeePerGas: ((baseFee + avgRewards[0] / count) / 1e9).toFixed(2),
          maxPriorityFeePerGas: ((avgRewards[0] / count) / 1e9).toFixed(2),
        },
        average: {
          maxFeePerGas: ((baseFee + avgRewards[1] / count) / 1e9).toFixed(2),
          maxPriorityFeePerGas: ((avgRewards[1] / count) / 1e9).toFixed(2),
        },
        high: {
          maxFeePerGas: ((baseFee + avgRewards[2] / count) / 1e9).toFixed(2),
          maxPriorityFeePerGas: ((avgRewards[2] / count) / 1e9).toFixed(2),
        },
        baseFee: (baseFee / 1e9).toFixed(2),
      };
    } else {
      // Legacy gas price only
      const gasPriceGwei = parseInt(gasPrice, 16) / 1e9;
      gasTiers = {
        low: { gasPrice: (gasPriceGwei * 0.9).toFixed(2) },
        average: { gasPrice: gasPriceGwei.toFixed(2) },
        high: { gasPrice: (gasPriceGwei * 1.2).toFixed(2) },
      };
    }

    return {
      success: true,
      data: {
        ...gasTiers,
        unit: "gwei",
      },
      metadata: {
        network: client.networkName,
        chainId: client.chainId,
        tool: "getGasPrices",
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get gas prices",
    };
  }
}

/**
 * Get contract bytecode
 */
export async function handleGetContractCode(
  input: GetContractCodeInput
): Promise<ToolResult> {
  try {
    const client = createRpcClient(input.network);
    
    const code = await client.getCode(input.address);
    const isContract = code !== "0x" && code.length > 2;

    return {
      success: true,
      data: {
        address: input.address,
        isContract,
        bytecodeLength: isContract ? (code.length - 2) / 2 : 0,
        bytecode: isContract ? code : null,
      },
      metadata: {
        network: client.networkName,
        chainId: client.chainId,
        tool: "getContractCode",
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get contract code",
    };
  }
}

/**
 * Call a contract (read-only)
 */
export async function handleCallContract(
  input: CallContractInput
): Promise<ToolResult> {
  try {
    const client = createRpcClient(input.network);
    
    const result = await client.call(input.to, input.data, input.from, input.value);

    return {
      success: true,
      data: {
        to: input.to,
        data: input.data,
        result,
        resultLength: (result.length - 2) / 2,
      },
      metadata: {
        network: client.networkName,
        chainId: client.chainId,
        tool: "callContract",
        timestamp: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to call contract",
    };
  }
}

/**
 * List supported networks (FREE)
 */
export function handleListNetworks(): ToolResult {
  const networks = listSupportedNetworks();

  return {
    success: true,
    data: {
      networks: networks.map(n => ({
        name: n.name,
        chainId: n.chainId,
        networkId: n.networkId,
      })),
      count: networks.length,
    },
    metadata: {
      network: "all",
      chainId: 0,
      tool: "listNetworks",
      timestamp: Date.now(),
    },
  };
}

/**
 * Get x402 payment information (FREE)
 */
export function handleGetX402Info(): ToolResult {
  const pricingInfo = Object.entries(TOOL_PRICING).map(([tool, pricing]) => ({
    tool,
    price: pricing.price,
    description: pricing.description,
    isFree: pricing.isFree,
  }));

  return {
    success: true,
    data: {
      protocol: "x402",
      version: "1.0",
      network: {
        name: PAYMENT_CONFIG.network,
        chainId: PAYMENT_CONFIG.chainId,
      },
      token: {
        symbol: PAYMENT_CONFIG.token.symbol,
        address: PAYMENT_CONFIG.token.address,
        decimals: PAYMENT_CONFIG.token.decimals,
      },
      facilitator: PAYMENT_CONFIG.facilitatorUrl,
      pricing: pricingInfo,
      documentation: "https://x402.org",
    },
    metadata: {
      network: "x402",
      chainId: PAYMENT_CONFIG.chainId,
      tool: "getX402Info",
      timestamp: Date.now(),
    },
  };
}
