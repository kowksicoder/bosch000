import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';

// WalletConnect project ID - will be set via environment variable
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

if (!projectId) {
  console.warn('VITE_WALLETCONNECT_PROJECT_ID not set. Get one at https://cloud.walletconnect.com');
}

export const config = getDefaultConfig({
  appName: 'CoinIT',
  projectId: projectId || 'demo-project-id', // Fallback for development
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: false,
});
