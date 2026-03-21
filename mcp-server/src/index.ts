/**
 * OpenScan MCP Server
 * 
 * Entry point for the MCP server that provides blockchain explorer tools
 * to AI agents with x402 payment integration.
 * 
 * Usage:
 *   - Stdio mode: node dist/index.js --stdio
 *   - HTTP mode: Import and use with Vercel/Express
 * 
 * @packageDocumentation
 */

export {
  createMcpServer,
  startStdioServer,
  getToolDefinitions,
  executeTool,
  type McpServerConfig,
} from "./server.js";

export {
  TOOL_PRICING,
  PAYMENT_CONFIG,
  getToolPricing,
  requiresPayment,
  getPaymentDetails,
  toAtomicUnits,
} from "./x402/index.js";

export {
  parseX402Header,
  verifyAndSettlePayment,
  generatePaymentChallenge,
  createX402Middleware,
  type X402PaymentHeader,
  type PaymentVerificationResult,
} from "./x402/facilitator.js";

export {
  SUPPORTED_NETWORKS,
  resolveNetworkConfig,
  listSupportedNetworks,
} from "./adapters/index.js";

export {
  createRpcClient,
  RpcClient,
} from "./tools/rpcClient.js";

// CLI entry point
const isMainModule = process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts");
const isStdioMode = process.argv.includes("--stdio");

if (isMainModule && isStdioMode) {
  import("./server.js").then(({ startStdioServer }) => {
    console.error("Starting OpenScan MCP Server in stdio mode...");
    startStdioServer().catch((error) => {
      console.error("Failed to start server:", error);
      process.exit(1);
    });
  });
}
