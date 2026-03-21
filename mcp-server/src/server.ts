/**
 * OpenScan MCP Server
 * 
 * Model Context Protocol server that provides blockchain explorer tools
 * to AI agents with x402 payment integration on Avalanche.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  // Schemas
  getAddressInfoSchema,
  getAddressTransactionsSchema,
  getTransactionSchema,
  getTransactionTraceSchema,
  getBlockSchema,
  getBlockWithTransactionsSchema,
  getLatestBlocksSchema,
  getNetworkStatsSchema,
  getGasPricesSchema,
  getContractCodeSchema,
  callContractSchema,
  listNetworksSchema,
  getX402InfoSchema,
  // Handlers
  handleGetAddressInfo,
  handleGetTransaction,
  handleGetTransactionTrace,
  handleGetBlock,
  handleGetBlockWithTransactions,
  handleGetLatestBlocks,
  handleGetNetworkStats,
  handleGetGasPrices,
  handleGetContractCode,
  handleCallContract,
  handleListNetworks,
  handleGetX402Info,
} from "./tools/index.js";

import { TOOL_PRICING, requiresPayment, getToolPricing } from "./x402/index.js";

/**
 * MCP Server Configuration
 */
export interface McpServerConfig {
  /** Server name */
  name?: string;
  /** Server version */
  version?: string;
  /** Whether to enable x402 payment verification */
  enablePayments?: boolean;
  /** Wallet address to receive payments */
  walletAddress?: string;
}

/**
 * Tool definition for MCP
 */
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  handler: (input: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }> | { success: boolean; data?: unknown; error?: string };
  pricing: {
    price: string;
    isFree: boolean;
  };
}

/**
 * All available tools
 */
const TOOLS: ToolDefinition[] = [
  // Address Tools
  {
    name: "getAddressInfo",
    description: "Get blockchain address information including balance, transaction count, and whether it's a contract. Supports multiple networks.",
    inputSchema: getAddressInfoSchema,
    handler: handleGetAddressInfo,
    pricing: TOOL_PRICING.getAddressInfo,
  },
  // Transaction Tools
  {
    name: "getTransaction",
    description: "Get transaction details including sender, receiver, value, gas, status, and receipt information.",
    inputSchema: getTransactionSchema,
    handler: handleGetTransaction,
    pricing: TOOL_PRICING.getTransaction,
  },
  {
    name: "getTransactionTrace",
    description: "Get detailed execution trace for a transaction. Useful for debugging and understanding contract interactions.",
    inputSchema: getTransactionTraceSchema,
    handler: handleGetTransactionTrace,
    pricing: TOOL_PRICING.getTransactionTrace,
  },
  // Block Tools
  {
    name: "getBlock",
    description: "Get block header and metadata by block number, tag (latest, earliest, pending), or hash.",
    inputSchema: getBlockSchema,
    handler: handleGetBlock,
    pricing: TOOL_PRICING.getBlock,
  },
  {
    name: "getBlockWithTransactions",
    description: "Get block with full transaction details. More expensive but provides complete transaction data.",
    inputSchema: getBlockWithTransactionsSchema,
    handler: handleGetBlockWithTransactions,
    pricing: TOOL_PRICING.getBlockWithTransactions,
  },
  {
    name: "getLatestBlocks",
    description: "Get the most recent blocks from the blockchain. Useful for monitoring chain activity.",
    inputSchema: getLatestBlocksSchema,
    handler: handleGetLatestBlocks,
    pricing: TOOL_PRICING.getLatestBlocks,
  },
  // Network Tools
  {
    name: "getNetworkStats",
    description: "Get network statistics including latest block, gas price, and base fee.",
    inputSchema: getNetworkStatsSchema,
    handler: handleGetNetworkStats,
    pricing: TOOL_PRICING.getNetworkStats,
  },
  {
    name: "getGasPrices",
    description: "Get current gas price tiers (low, average, high) for transaction planning.",
    inputSchema: getGasPricesSchema,
    handler: handleGetGasPrices,
    pricing: TOOL_PRICING.getGasPrices,
  },
  // Contract Tools
  {
    name: "getContractCode",
    description: "Get the deployed bytecode of a contract address.",
    inputSchema: getContractCodeSchema,
    handler: handleGetContractCode,
    pricing: TOOL_PRICING.getContractCode,
  },
  {
    name: "callContract",
    description: "Execute a read-only contract call. Requires encoded function call data.",
    inputSchema: callContractSchema,
    handler: handleCallContract,
    pricing: TOOL_PRICING.callContract,
  },
  // Free Tools
  {
    name: "listNetworks",
    description: "List all supported blockchain networks. FREE - no payment required.",
    inputSchema: listNetworksSchema,
    handler: handleListNetworks,
    pricing: TOOL_PRICING.listNetworks,
  },
  {
    name: "getX402Info",
    description: "Get x402 payment information including pricing for all tools and payment configuration. FREE - no payment required.",
    inputSchema: getX402InfoSchema,
    handler: handleGetX402Info,
    pricing: TOOL_PRICING.getX402Info,
  },
];

/**
 * Create and configure the MCP server
 */
export function createMcpServer(config: McpServerConfig = {}): McpServer {
  const {
    name = "openscan-mcp",
    version = "0.1.0",
    enablePayments = true,
    walletAddress = process.env.OPENSCAN_WALLET_ADDRESS,
  } = config;

  const server = new McpServer({
    name,
    version,
  });

  // Register all tools
  for (const tool of TOOLS) {
    const jsonSchema = zodToJsonSchema(tool.inputSchema, {
      $refStrategy: "none",
    });

    // Remove $schema from the JSON schema as MCP doesn't expect it
    const { $schema, ...inputSchema } = jsonSchema as Record<string, unknown>;

    server.tool(
      tool.name,
      `${tool.description}${tool.pricing.isFree ? "" : ` [Cost: $${tool.pricing.price} USDC]`}`,
      inputSchema,
      async (args) => {
        // Validate input
        const parseResult = tool.inputSchema.safeParse(args);
        if (!parseResult.success) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: `Invalid input: ${parseResult.error.message}`,
                }),
              },
            ],
          };
        }

        // Execute handler
        const result = await tool.handler(parseResult.data);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );
  }

  return server;
}

/**
 * Start the MCP server with stdio transport
 */
export async function startStdioServer(config: McpServerConfig = {}): Promise<void> {
  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  
  // Keep the server running
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

/**
 * Get tool definitions for external use (e.g., HTTP API)
 */
export function getToolDefinitions() {
  return TOOLS.map(tool => {
    const jsonSchema = zodToJsonSchema(tool.inputSchema, {
      $refStrategy: "none",
    });
    const { $schema, ...inputSchema } = jsonSchema as Record<string, unknown>;

    return {
      name: tool.name,
      description: tool.description,
      inputSchema,
      pricing: tool.pricing,
    };
  });
}

/**
 * Execute a tool by name (for HTTP API)
 */
export async function executeTool(
  toolName: string,
  input: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const tool = TOOLS.find(t => t.name === toolName);
  
  if (!tool) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }

  const parseResult = tool.inputSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: `Invalid input: ${parseResult.error.message}`,
    };
  }

  return tool.handler(parseResult.data);
}
