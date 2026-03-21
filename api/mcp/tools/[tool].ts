/**
 * OpenScan MCP Tool Execution Endpoint
 * 
 * Direct tool execution endpoint for convenience.
 * 
 * Usage:
 *   POST /api/mcp/tools/getAddressInfo
 *   Body: { "address": "0x...", "network": "avalanche" }
 *   Headers: X-Payment: x402 <payment-payload> (for paid tools)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  executeTool,
  getToolPricing,
  parseX402Header,
  verifyAndSettlePayment,
  generatePaymentChallenge,
} from "../../../mcp-server/src/index.js";

/**
 * CORS headers
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Payment",
  "Access-Control-Expose-Headers": "X-Payment-Required, X-Payment-Amount, X-Payment-Challenge",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`,
    });
    return;
  }

  const walletAddress = process.env.OPENSCAN_WALLET_ADDRESS;
  if (!walletAddress) {
    res.status(500).json({
      success: false,
      error: "Server configuration error",
    });
    return;
  }

  // Get tool name from path
  const { tool } = req.query;
  const toolName = Array.isArray(tool) ? tool[0] : tool;

  if (!toolName) {
    res.status(400).json({
      success: false,
      error: "Tool name is required",
    });
    return;
  }

  // Check pricing
  const pricing = getToolPricing(toolName);
  if (!pricing) {
    res.status(404).json({
      success: false,
      error: `Unknown tool: ${toolName}`,
    });
    return;
  }

  // Handle payment for paid tools
  if (!pricing.isFree) {
    const paymentHeader = req.headers["x-payment"] as string | undefined;
    const payment = parseX402Header(paymentHeader || null);

    if (!payment) {
      const challenge = generatePaymentChallenge(toolName, pricing.priceAtomic, walletAddress);
      res.status(402)
        .setHeader("X-Payment-Required", "true")
        .setHeader("X-Payment-Amount", pricing.priceAtomic)
        .json({
          success: false,
          error: "Payment required",
          tool: toolName,
          price: pricing.price,
          priceAtomic: pricing.priceAtomic,
          payment: challenge,
        });
      return;
    }

    const verification = await verifyAndSettlePayment(
      payment,
      pricing.priceAtomic,
      walletAddress
    );

    if (!verification.valid) {
      res.status(402).json({
        success: false,
        error: `Payment failed: ${verification.error}`,
      });
      return;
    }
  }

  try {
    const result = await executeTool(toolName, req.body || {});
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Tool execution failed",
    });
  }
}
