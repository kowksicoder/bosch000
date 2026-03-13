import { createPublicClient, createWalletClient, http, parseEther, parseUnits, type Address, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { setApiKey, tradeCoin } from "@zoralabs/coins-sdk";

type TreasuryTradeConfig = {
  chainId: number;
  rpcUrl: string;
  treasuryAccount: Address;
};

let cachedConfig: TreasuryTradeConfig | null = null;

function resolveTreasuryConfig(): TreasuryTradeConfig {
  if (cachedConfig) return cachedConfig;

  const privateKey = process.env.TREASURY_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing TREASURY_PRIVATE_KEY");
  }

  const zoraApiKey = process.env.ZORA_API_KEY || process.env.VITE_NEXT_PUBLIC_ZORA_API_KEY || "";
  if (zoraApiKey) {
    setApiKey(zoraApiKey);
  }

  const useSepolia = !!process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL;
  const chain = useSepolia ? baseSepolia : base;

  const rpcUrl =
    (useSepolia
      ? process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL
      : process.env.ONCHAIN_BASE_RPC_URL) ||
    process.env.VITE_ZORA_RPC_URL ||
    (useSepolia
      ? "https://sepolia.base.org"
      : "https://base-mainnet.g.alchemy.com/v2/" + (process.env.VITE_ALCHEMY_API_KEY || ""));

  if (!rpcUrl) {
    throw new Error("Missing RPC URL for treasury trades");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  cachedConfig = {
    chainId: chain.id,
    rpcUrl,
    treasuryAccount: account.address,
  };

  return cachedConfig;
}

export function getTreasuryAddress(): Address {
  const privateKey = process.env.TREASURY_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing TREASURY_PRIVATE_KEY");
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return account.address;
}

export async function executeTreasuryBuy({
  creatorTokenAddress,
  recipientAddress,
  ethAmount,
  slippage = 0.05,
}: {
  creatorTokenAddress: Address;
  recipientAddress: Address;
  ethAmount: string;
  slippage?: number;
}) {
  const config = resolveTreasuryConfig();
  const chain = config.chainId === baseSepolia.id ? baseSepolia : base;
  const account = privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY as `0x${string}`);

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    chain,
    account,
    transport: http(config.rpcUrl),
  });

  const amountInWei = parseEther(ethAmount);
  if (amountInWei <= 0n) {
    throw new Error("Invalid ETH amount for treasury trade");
  }

  const tradeParameters = {
    sell: { type: "eth" as const },
    buy: { type: "erc20" as const, address: creatorTokenAddress },
    amountIn: amountInWei,
    slippage,
    sender: config.treasuryAccount,
    recipient: recipientAddress,
  };

  const receipt = await tradeCoin({
    tradeParameters,
    walletClient,
    account,
    publicClient,
  });

  if (!receipt || receipt.status !== "success") {
    throw new Error("Treasury trade failed");
  }

  return {
    hash: receipt.transactionHash,
    receipt,
  };
}

export async function executeTreasurySell({
  creatorTokenAddress,
  tokenAmount,
  tokenDecimals = 18,
  slippage = 0.05,
}: {
  creatorTokenAddress: Address;
  tokenAmount: string;
  tokenDecimals?: number;
  slippage?: number;
}) {
  const config = resolveTreasuryConfig();
  const chain = config.chainId === baseSepolia.id ? baseSepolia : base;
  const account = privateKeyToAccount(process.env.TREASURY_PRIVATE_KEY as `0x${string}`);

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    chain,
    account,
    transport: http(config.rpcUrl),
  });

  const amountInUnits = parseUnits(tokenAmount, tokenDecimals);
  if (amountInUnits <= 0n) {
    throw new Error("Invalid token amount for treasury sell");
  }

  const tradeParameters = {
    sell: { type: "erc20" as const, address: creatorTokenAddress },
    buy: { type: "eth" as const },
    amountIn: amountInUnits,
    slippage,
    sender: config.treasuryAccount,
  };

  const receipt = await tradeCoin({
    tradeParameters,
    walletClient,
    account,
    publicClient,
  });

  if (!receipt || receipt.status !== "success") {
    throw new Error("Treasury sell failed");
  }

  return {
    hash: receipt.transactionHash,
    receipt,
  };
}
