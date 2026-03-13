import { storage } from "./supabase-storage";

export const REFERRAL_CODE_MIN_LENGTH = 3;
export const REFERRAL_CODE_MAX_LENGTH = 20;

const WALLET_LIKE_PATTERN = /^0x[a-f0-9]{6,}$/i;
const VALID_REFERRAL_PATTERN = /^[a-z0-9_]{3,20}$/;

export const isWalletLikeReferralCode = (value: string) => WALLET_LIKE_PATTERN.test(value);

export const sanitizeReferralCode = (value: string) => {
  const trimmed = String(value || "").trim().toLowerCase();
  const withoutDomain = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  const cleaned = withoutDomain
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  return cleaned.slice(0, REFERRAL_CODE_MAX_LENGTH);
};

export const isValidReferralCode = (value: string) =>
  VALID_REFERRAL_PATTERN.test(value) && !isWalletLikeReferralCode(value);

const buildReferralBase = (email?: string | null, username?: string | null) => {
  const emailBase = email ? sanitizeReferralCode(email) : "";
  if (emailBase.length >= REFERRAL_CODE_MIN_LENGTH) return emailBase;

  const usernameBase = username ? sanitizeReferralCode(username) : "";
  if (usernameBase.length >= REFERRAL_CODE_MIN_LENGTH) return usernameBase;

  return "every1";
};

const isReferralCodeTaken = async ({
  code,
  userId,
  privyId,
  address,
  creatorId,
}: {
  code: string;
  userId?: string | null;
  privyId?: string | null;
  address?: string | null;
  creatorId?: string | null;
}) => {
  const existingUser = await storage.getUserByReferralCode(code);
  if (existingUser && existingUser.id !== userId) {
    return true;
  }

  const existingCreator = await storage.getCreatorByReferralCode(code);
  if (!existingCreator) return false;

  if (creatorId && existingCreator.id === creatorId) return false;
  if (privyId && existingCreator.privyId === privyId) return false;
  if (address && existingCreator.address && existingCreator.address === address) return false;

  return true;
};

export const generateUniqueReferralCode = async ({
  email,
  username,
  privyId,
  address,
  existingCode,
  userId,
  creatorId,
}: {
  email?: string | null;
  username?: string | null;
  privyId?: string | null;
  address?: string | null;
  existingCode?: string | null;
  userId?: string | null;
  creatorId?: string | null;
}) => {
  if (existingCode && isValidReferralCode(existingCode)) {
    return existingCode.toLowerCase();
  }

  const base = buildReferralBase(email, username);
  let code = base.slice(0, REFERRAL_CODE_MAX_LENGTH);
  let attempt = 0;

  while (await isReferralCodeTaken({ code, userId, privyId, address, creatorId })) {
    attempt += 1;
    const suffixSource = privyId?.slice(-4) || Math.random().toString(36).slice(2, 6);
    const suffix = sanitizeReferralCode(suffixSource) || "1";
    const maxBaseLength = Math.max(
      REFERRAL_CODE_MIN_LENGTH,
      REFERRAL_CODE_MAX_LENGTH - (suffix.length + 1),
    );
    const trimmedBase = base.slice(0, maxBaseLength);
    code = `${trimmedBase}_${suffix}`;

    if (attempt > 6) {
      const fallback = Math.random().toString(36).slice(2, 6);
      code = `${trimmedBase}_${fallback}`;
    }
  }

  return code;
};
