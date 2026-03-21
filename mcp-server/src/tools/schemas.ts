/**
 * Zod Schemas for MCP Tool Inputs
 * 
 * These schemas define the input validation for all MCP tools
 */

import { z } from "zod";

/**
 * Common schema for Ethereum addresses
 */
export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
  .describe("Ethereum address (0x prefixed, 40 hex characters)");

/**
 * Common schema for transaction hashes
 */
export const transactionHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash format")
  .describe("Transaction hash (0x prefixed, 64 hex characters)");

/**
 * Common schema for block hashes
 */
export const blockHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid block hash format")
  .describe("Block hash (0x prefixed, 64 hex characters)");

/**
 * Block identifier - can be number, "latest", "earliest", "pending", or hash
 */
export const blockIdentifierSchema = z
  .union([
    z.number().int().nonnegative().describe("Block number"),
    z.enum(["latest", "earliest", "pending", "finalized", "safe"]).describe("Block tag"),
    blockHashSchema,
  ])
  .describe("Block identifier (number, tag, or hash)");

/**
 * Network identifier
 */
export const networkSchema = z
  .string()
  .default("avalanche")
  .describe("Network identifier (avalanche, ethereum, base, polygon, arbitrum, optimism)");

// ============== Tool Input Schemas ==============

/**
 * getAddressInfo input schema
 */
export const getAddressInfoSchema = z.object({
  address: ethereumAddressSchema,
  network: networkSchema,
});

/**
 * getAddressTransactions input schema
 */
export const getAddressTransactionsSchema = z.object({
  address: ethereumAddressSchema,
  network: networkSchema,
  limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of transactions to return"),
  fromBlock: z.number().int().nonnegative().optional().describe("Starting block number"),
  toBlock: z.number().int().nonnegative().optional().describe("Ending block number"),
});

/**
 * getTransaction input schema
 */
export const getTransactionSchema = z.object({
  hash: transactionHashSchema,
  network: networkSchema,
});

/**
 * getTransactionTrace input schema
 */
export const getTransactionTraceSchema = z.object({
  hash: transactionHashSchema,
  network: networkSchema,
  traceType: z.enum(["call", "prestate", "structLogs"]).default("call").describe("Type of trace to retrieve"),
});

/**
 * getBlock input schema
 */
export const getBlockSchema = z.object({
  block: blockIdentifierSchema,
  network: networkSchema,
});

/**
 * getBlockWithTransactions input schema
 */
export const getBlockWithTransactionsSchema = z.object({
  block: blockIdentifierSchema,
  network: networkSchema,
});

/**
 * getLatestBlocks input schema
 */
export const getLatestBlocksSchema = z.object({
  network: networkSchema,
  count: z.number().int().min(1).max(20).default(10).describe("Number of blocks to return"),
});

/**
 * getNetworkStats input schema
 */
export const getNetworkStatsSchema = z.object({
  network: networkSchema,
});

/**
 * getGasPrices input schema
 */
export const getGasPricesSchema = z.object({
  network: networkSchema,
});

/**
 * getContractCode input schema
 */
export const getContractCodeSchema = z.object({
  address: ethereumAddressSchema,
  network: networkSchema,
});

/**
 * callContract input schema
 */
export const callContractSchema = z.object({
  to: ethereumAddressSchema.describe("Contract address to call"),
  data: z.string().regex(/^0x[a-fA-F0-9]*$/, "Invalid calldata format").describe("Encoded function call data"),
  network: networkSchema,
  from: ethereumAddressSchema.optional().describe("Optional sender address"),
  value: z.string().optional().describe("Optional value to send (in wei)"),
});

/**
 * listNetworks input schema (free tool)
 */
export const listNetworksSchema = z.object({});

/**
 * getX402Info input schema (free tool)
 */
export const getX402InfoSchema = z.object({});

// ============== Type Exports ==============

export type GetAddressInfoInput = z.infer<typeof getAddressInfoSchema>;
export type GetAddressTransactionsInput = z.infer<typeof getAddressTransactionsSchema>;
export type GetTransactionInput = z.infer<typeof getTransactionSchema>;
export type GetTransactionTraceInput = z.infer<typeof getTransactionTraceSchema>;
export type GetBlockInput = z.infer<typeof getBlockSchema>;
export type GetBlockWithTransactionsInput = z.infer<typeof getBlockWithTransactionsSchema>;
export type GetLatestBlocksInput = z.infer<typeof getLatestBlocksSchema>;
export type GetNetworkStatsInput = z.infer<typeof getNetworkStatsSchema>;
export type GetGasPricesInput = z.infer<typeof getGasPricesSchema>;
export type GetContractCodeInput = z.infer<typeof getContractCodeSchema>;
export type CallContractInput = z.infer<typeof callContractSchema>;
