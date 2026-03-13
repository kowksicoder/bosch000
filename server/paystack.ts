import axios from "axios";
import crypto from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export type PaystackInitializePayload = {
  email: string;
  amount: number; // in kobo
  reference: string;
  callback_url?: string;
  metadata?: Record<string, any>;
};

export type PaystackTransferRecipientPayload = {
  type: "nuban";
  name: string;
  account_number: string;
  bank_code: string;
  currency?: "NGN";
};

export type PaystackTransferPayload = {
  source: "balance";
  amount: number; // in kobo
  recipient: string;
  reason?: string;
  reference?: string;
};

export async function initializePaystackPayment(payload: PaystackInitializePayload) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing PAYSTACK_SECRET_KEY");
  }

  const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, payload, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

export async function createPaystackTransferRecipient(payload: PaystackTransferRecipientPayload) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing PAYSTACK_SECRET_KEY");
  }

  const response = await axios.post(`${PAYSTACK_BASE_URL}/transferrecipient`, payload, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

export async function initiatePaystackTransfer(payload: PaystackTransferPayload) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing PAYSTACK_SECRET_KEY");
  }

  const response = await axios.post(`${PAYSTACK_BASE_URL}/transfer`, payload, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

export async function getPaystackBalance() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing PAYSTACK_SECRET_KEY");
  }

  const response = await axios.get(`${PAYSTACK_BASE_URL}/balance`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

export function verifyPaystackSignature(rawBody: Buffer | string, signature?: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !signature) {
    return false;
  }

  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  return hash === signature;
}
