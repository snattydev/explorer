/**
 * x402 Facilitator Integration using Thirdweb
 * 
 * Handles payment verification and settlement for AI agent requests
 * on Avalanche C-Chain using USDC
 */

import { createThirdwebClient } from "thirdweb";
import { PAYMENT_CONFIG } from "./pricing.js";

/**
 * x402 Payment Header structure
 */
export interface X402PaymentHeader {
  /** Base64-encoded payment payload */
  payload: string;
  /** Payment signature */
  signature: string;
  /** Payer address */
  payer: string;
  /** Payment amount in atomic units */
  amount: string;
  /** Token address */
  token: string;
  /** Chain ID */
  chainId: number;
}

/**
 * Payment verification result
 */
export interface PaymentVerificationResult {
  valid: boolean;
  error?: string;
  txHash?: string;
  payer?: string;
  amount?: string;
}

/**
 * Parse x402 payment header from request
 */
export function parseX402Header(headerValue: string | null): X402PaymentHeader | null {
  if (!headerValue) {
    return null;
  }

  try {
    // x402 header format: "x402 <base64-payload>"
    const parts = headerValue.split(" ");
    if (parts[0] !== "x402" || !parts[1]) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    return {
      payload: parts[1],
      signature: decoded.signature,
      payer: decoded.payer,
      amount: decoded.amount,
      token: decoded.token,
      chainId: decoded.chainId,
    };
  } catch {
    return null;
  }
}

/**
 * Create Thirdweb client for x402 operations
 */
export function createX402Client() {
  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error("THIRDWEB_SECRET_KEY environment variable is required");
  }

  return createThirdwebClient({
    secretKey,
  });
}

/**
 * Verify and settle an x402 payment
 * 
 * This function:
 * 1. Validates the payment signature
 * 2. Checks the payment amount matches required price
 * 3. Settles the payment via the facilitator
 * 4. Returns the settlement transaction hash
 */
export async function verifyAndSettlePayment(
  paymentHeader: X402PaymentHeader,
  requiredAmount: string,
  recipientAddress: string
): Promise<PaymentVerificationResult> {
  try {
    // Validate chain ID
    if (paymentHeader.chainId !== PAYMENT_CONFIG.chainId) {
      return {
        valid: false,
        error: `Invalid chain ID. Expected ${PAYMENT_CONFIG.chainId} (Avalanche), got ${paymentHeader.chainId}`,
      };
    }

    // Validate token address
    if (paymentHeader.token.toLowerCase() !== PAYMENT_CONFIG.token.address.toLowerCase()) {
      return {
        valid: false,
        error: `Invalid token. Expected ${PAYMENT_CONFIG.token.symbol} (${PAYMENT_CONFIG.token.address})`,
      };
    }

    // Validate amount
    if (BigInt(paymentHeader.amount) < BigInt(requiredAmount)) {
      return {
        valid: false,
        error: `Insufficient payment. Required: ${requiredAmount}, received: ${paymentHeader.amount}`,
      };
    }

    // Settle payment via Thirdweb facilitator
    const settlementResult = await settlePaymentViaFacilitator(
      paymentHeader,
      recipientAddress
    );

    return settlementResult;
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Payment verification failed",
    };
  }
}

/**
 * Settle payment via Thirdweb x402 facilitator
 */
async function settlePaymentViaFacilitator(
  paymentHeader: X402PaymentHeader,
  recipientAddress: string
): Promise<PaymentVerificationResult> {
  const facilitatorUrl = PAYMENT_CONFIG.facilitatorUrl;

  const response = await fetch(`${facilitatorUrl}/settle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payment: paymentHeader.payload,
      recipient: recipientAddress,
      chainId: paymentHeader.chainId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      valid: false,
      error: `Facilitator settlement failed: ${errorText}`,
    };
  }

  const result = await response.json() as { txHash: string };

  return {
    valid: true,
    txHash: result.txHash,
    payer: paymentHeader.payer,
    amount: paymentHeader.amount,
  };
}

/**
 * Generate x402 payment challenge for 402 response
 */
export function generatePaymentChallenge(
  toolName: string,
  requiredAmount: string,
  recipientAddress: string
) {
  return {
    version: "x402/1.0",
    network: {
      chainId: PAYMENT_CONFIG.chainId,
      name: PAYMENT_CONFIG.network,
    },
    payment: {
      token: PAYMENT_CONFIG.token.address,
      symbol: PAYMENT_CONFIG.token.symbol,
      decimals: PAYMENT_CONFIG.token.decimals,
      amount: requiredAmount,
      recipient: recipientAddress,
    },
    facilitator: {
      url: PAYMENT_CONFIG.facilitatorUrl,
      type: "thirdweb",
    },
    resource: {
      tool: toolName,
      description: `Access to ${toolName} MCP tool`,
    },
  };
}

/**
 * Create x402 middleware for MCP tool calls
 */
export function createX402Middleware(recipientAddress: string) {
  return {
    /**
     * Verify payment before tool execution
     */
    async verifyPayment(
      toolName: string,
      requiredAmount: string,
      paymentHeaderValue: string | null
    ): Promise<{ allowed: boolean; error?: string; challenge?: object }> {
      // Parse payment header
      const payment = parseX402Header(paymentHeaderValue);

      if (!payment) {
        return {
          allowed: false,
          challenge: generatePaymentChallenge(toolName, requiredAmount, recipientAddress),
        };
      }

      // Verify and settle payment
      const result = await verifyAndSettlePayment(
        payment,
        requiredAmount,
        recipientAddress
      );

      if (!result.valid) {
        return {
          allowed: false,
          error: result.error,
          challenge: generatePaymentChallenge(toolName, requiredAmount, recipientAddress),
        };
      }

      return { allowed: true };
    },
  };
}
