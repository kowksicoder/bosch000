import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createPublicClient, http, type Address, type Chain, createWalletClient, custom } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import type { SmartAccountClient } from 'permissionless';
import { entryPoint07Address } from 'viem/account-abstraction';

const ENTRYPOINT_ADDRESS_V07 = entryPoint07Address;

interface SmartAccountContextType {
  smartAccountClient: SmartAccountClient | null;
  smartAccountAddress: Address | null;
  isLoading: boolean;
  error: string | null;
  initSmartAccount: () => Promise<{ client: SmartAccountClient; address: Address } | null>;
}

const SmartAccountContext = createContext<SmartAccountContextType>({
  smartAccountClient: null,
  smartAccountAddress: null,
  isLoading: false,
  error: null,
  initSmartAccount: async () => null,
});

export const useSmartAccount = () => useContext(SmartAccountContext);

interface SmartAccountProviderProps {
  children: ReactNode;
}

export function SmartAccountProvider({ children }: SmartAccountProviderProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [smartAccountClient, setSmartAccountClient] = useState<SmartAccountClient | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initSmartAccount = useCallback(async () => {
    if (!authenticated || !user) {
      console.log("❌ Cannot initialize: User not authenticated");
      return null;
    }

    // Wait for wallets to be available
    if (!wallets || wallets.length === 0) {
      console.log("⏳ Waiting for wallets to be available...");
      return null;
    }

    // Check if we already have a smart account for this user
    if (smartAccountClient && smartAccountAddress) {
      console.log("✅ Smart account already initialized:", smartAccountAddress);
      return { client: smartAccountClient, address: smartAccountAddress };
    }

    setIsLoading(true);
    setError(null);

    try {
      const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy');

      if (!embeddedWallet) {
        console.log("⏳ No embedded wallet found yet, waiting...");
        setIsLoading(false);
        return null;
      }

      console.log("💼 Found wallet:", embeddedWallet.walletClientType);

      // Get network preference
      const networkPreference = localStorage.getItem('ADMIN_NETWORK_PREFERENCE') as 'sepolia' | 'mainnet' | null;
      const chain = networkPreference === 'mainnet' ? base : baseSepolia;
      const paymasterUrl = networkPreference === 'mainnet'
        ? `https://api.developer.coinbase.com/rpc/v1/base/${import.meta.env.VITE_COINBASE_PAYMASTER_API_KEY}`
        : `https://api.developer.coinbase.com/rpc/v1/base-sepolia/${import.meta.env.VITE_COINBASE_PAYMASTER_API_KEY}`;

      console.log(`🔐 Initializing smart account on ${chain.name}...`);
      console.log("📡 Using Base Paymaster RPC:", paymasterUrl);

      // Create public client for the chain
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });

      // Get the EIP1193 provider from Privy wallet
      const provider = await embeddedWallet.getEthereumProvider();

      // Get the wallet address
      const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in wallet");
      }
      const ownerAddress = accounts[0] as Address;
      console.log("👤 Owner address:", ownerAddress);

      // Create wallet client from the provider
      const walletClient = createWalletClient({
        account: ownerAddress,
        chain,
        transport: custom(provider),
      });

      // Create simple smart account
      const account = await toSimpleSmartAccount({
        client: publicClient,
        owner: walletClient,
        entryPoint: {
          address: ENTRYPOINT_ADDRESS_V07,
          version: "0.7"
        },
      });

      console.log('✅ Smart account created:', account.address);

      // Create smart account client with Base Paymaster
      const client = createSmartAccountClient({
        account,
        chain,
        bundlerTransport: http(paymasterUrl),
        paymaster: {
          getPaymasterData: async (userOperation: any) => {
            // Base Paymaster handles paymaster data automatically via RPC
            return {
              paymaster: undefined,
              paymasterData: '0x',
            };
          },
        },
        userOperation: {
          estimateFeesPerGas: async () => {
            const fees = await publicClient.estimateFeesPerGas();
            return {
              maxFeePerGas: fees.maxFeePerGas || BigInt(0),
              maxPriorityFeePerGas: fees.maxPriorityFeePerGas || BigInt(0),
            };
          },
        },
      });

      setSmartAccountClient(client as SmartAccountClient);
      setSmartAccountAddress(account.address);

      console.log("✅ Smart account client ready");
      console.log("📍 Smart account address:", account.address);
      
      return { client: client as SmartAccountClient, address: account.address };
    } catch (err) {
      console.error("❌ Failed to initialize smart account:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize smart account");

      // Retry once after a short delay
      setTimeout(() => {
        if (!smartAccountClient && authenticated && wallets && wallets.length > 0) {
          console.log("🔄 Retrying smart account initialization...");
          setError(null);
          initSmartAccount();
        }
      }, 2000);
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authenticated, user, wallets, smartAccountClient, smartAccountAddress]);

  // Auto-initialize smart account when user is ready (silent background process)
  useEffect(() => {
    if (ready && authenticated && wallets && wallets.length > 0 && !smartAccountClient && !isLoading) {
      initSmartAccount();
    }
  }, [ready, authenticated, wallets, smartAccountClient, isLoading, initSmartAccount]);

  return (
    <SmartAccountContext.Provider
      value={{
        smartAccountClient,
        smartAccountAddress,
        isLoading,
        error,
        initSmartAccount,
      }}
    >
      {children}
    </SmartAccountContext.Provider>
  );
}