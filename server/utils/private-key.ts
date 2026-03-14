import { privateKeyToAccount } from "viem/accounts";

type HexPrivateKey = `0x${string}`;

function normalizePrivateKey(raw?: string | null): HexPrivateKey | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return null;
  return trimmed as HexPrivateKey;
}

export function getAccountFromPrivateKey(raw?: string | null) {
  const normalized = normalizePrivateKey(raw);
  if (!normalized) return null;
  try {
    return privateKeyToAccount(normalized);
  } catch {
    return null;
  }
}

export function isValidPrivateKey(raw?: string | null): boolean {
  return Boolean(normalizePrivateKey(raw));
}
