/**
 * OpenScan MCP API Endpoint
 * 
 * HTTP endpoint for AI agents to interact with the blockchain explorer
 * via the Model Context Protocol with x402 payments.
 * 
 * Endpoints:
 *   GET  /api/mcp - Get server info and tool definitions
 *   POST /api/mcp - Execute a tool (requires x402 payment for paid tools)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

// Import from the MCP server package
// Note: In production, these would be built and imported from the mcp-server dist
import {
  getToolDefinitions,
  executeTool,
  PAYMENT_CONFIG,
  TOOL_PRICING,
  requiresPayment,
  getToolPricing,
  parseX402Header,
  verifyAndSettlePayment,
  generatePaymentChallenge,
} from "../../mcp-server/src/index.js";

/**
 * CORS headers for API responses
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Payment",
  "Access-Control-Expose-Headers": "X-Payment-Required, X-Payment-Amount, X-Payment-Challenge",
};

/**
 * Handle CORS preflight
 */
function handleOptions(res: VercelResponse) {
  res.status(204).setHeader("Access-Control-Allow-Origin", "*");
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
  res.end();
}

/**
 * GET /api/mcp - Server info and tool definitions
 */
async function handleGet(req: VercelRequest, res: VercelResponse) {
  const tools = getToolDefinitions();

  res.status(200).json({
    name: "openscan-mcp",
    version: "0.1.0",
    description: "OpenScan Blockchain Explorer MCP Server with x402 payments",
    protocol: "mcp",
    payment: {
      protocol: "x402",
      network: PAYMENT_CONFIG.network,
      chainId: PAYMENT_CONFIG.chainId,
      token: PAYMENT_CONFIG.token,
      facilitator: PAYMENT_CONFIG.facilitatorUrl,
    },
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      pricing: tool.pricing,
    })),
    documentation: {
      mcp: "https://modelcontextprotocol.io",
      x402: "https://x402.org",
      openscan: "https://openscan.io",
    },
  });
}

/**
 * POST /api/mcp - Execute a tool
 */
async function handlePost(req: VercelRequest, res: VercelResponse) {
  const walletAddress = process.env.OPENSCAN_WALLET_ADDRESS;

  if (!walletAddress) {
    res.status(500).json({
      success: false,
      error: "Server configuration error: wallet address not configured",
    });
    return;
  }

  // Parse request body
  const { tool, input } = req.body as { tool?: string; input?: unknown };

  if (!tool) {
    res.status(400).json({
      success: false,
      error: "Missing required field: tool",
    });
    return;
  }

  // Check if tool requires payment
  const pricing = getToolPricing(tool);
  
  if (!pricing) {
    res.status(404).json({
      success: false,
      error: `Unknown tool: ${tool}`,
    });
    return;
  }

  // Handle paid tools
  if (!pricing.isFree) {
    const paymentHeader = req.headers["x-payment"] as string | undefined;
    const payment = parseX402Header(paymentHeader || null);

    if (!payment) {
      // Return 402 Payment Required with challenge
      const challenge = generatePaymentChallenge(tool, pricing.priceAtomic, walletAddress);
      
      res.status(402)
        .setHeader("X-Payment-Required", "true")
        .setHeader("X-Payment-Amount", pricing.priceAtomic)
        .setHeader("X-Payment-Challenge", JSON.stringify(challenge))
        .json({
          success: false,
          error: "Payment required",
          payment: challenge,
        });
      return;
    }

    // Verify and settle payment
    const verificationResult = await verifyAndSettlePayment(
      payment,
      pricing.priceAtomic,
      walletAddress
    );

    if (!verificationResult.valid) {
      res.status(402).json({
        success: false,
        error: `Payment verification failed: ${verificationResult.error}`,
        payment: generatePaymentChallenge(tool, pricing.priceAtomic, walletAddress),
      });
      return;
    }
  }

  // Execute the tool
  const result = await executeTool(tool, input || {});

  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.status(200).json(result);
}

/**
 * Main handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  try {
    switch (req.method) {
      case "OPTIONS":
        handleOptions(res);
        break;
      case "GET":
        await handleGet(req, res);
        break;
      case "POST":
        await handlePost(req, res);
        break;
      default:
        res.status(405).json({
          success: false,
          error: `Method ${req.method} not allowed`,
        });
    }
  } catch (error) {
    console.error("MCP API error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
