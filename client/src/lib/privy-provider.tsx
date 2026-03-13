import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { base, baseSepolia } from 'viem/chains';
import { SmartAccountProvider } from '@/contexts/SmartAccountContext';
import { useEffect, useRef } from 'react';

function AuthHandler({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const hasHandledLogin = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || !user || hasHandledLogin.current) {
      return;
    }

    const handleLogin = async () => {
      try {
        // Get Privy user ID (primary identifier)
        const privyId = user?.id;
        // Get wallet address if available (wallet login or embedded wallet)
        const address = user?.wallet?.address || user?.linkedAccounts?.find((acc: any) => acc.type === 'wallet')?.address;
        // Get email if available (email login)
        const email = user?.email?.address || user?.linkedAccounts?.find((acc: any) => acc.type === 'email')?.address;

        if (!privyId) {
          console.error('No Privy ID found for user');
          return;
        }

        console.log('User logged in:', { privyId, address, email });

        // Create or update creator profile - wait for this to complete
        const creatorResponse = await fetch('/api/creators/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            privyId, 
            address: address || null,
            email: email || null 
          }),
          credentials: 'include',
        });

        if (!creatorResponse.ok) {
          const errorData = await creatorResponse.json();
          console.error('❌ Failed to sync creator profile:', errorData);
          return;
        }

        const creatorData = await creatorResponse.json();
        console.log('✅ Creator profile synced:', creatorData.id);

        // Trigger daily login to award welcome bonus (works for both email and wallet users)
        if (privyId) {
          const response = await fetch('/api/login-streak/check-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              privyId, 
              address: address || null // address can be null for email users
            }),
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            if (data.isFirstLogin) {
              console.log('✅ Welcome bonus awarded!', data);
              // Show success notification to user
              const event = new CustomEvent('e1xp-claimed', { 
                detail: { 
                  points: data.pointsEarned || 10,
                  message: 'Welcome to CoinIT! 🎉'
                }
              });
              window.dispatchEvent(event);
            } else if (data.pointsEarned > 0) {
              console.log('✅ Daily login bonus!', data);
            }
          } else {
            const errorData = await response.json();
            console.error('❌ Failed to award welcome bonus:', errorData);
          }
        }

        hasHandledLogin.current = true;
      } catch (error) {
        console.error('Failed to handle login:', error);
      }
    };

    handleLogin();
  }, [ready, authenticated, user]);

  return <>{children}</>;
}

export function AppPrivyProvider({ children }: { children: React.ReactNode }) {

  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || ''}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#22c55e',
          logo: 'https://i.ibb.co/JRQCPsZK/ev122logo-1-1.png',
          landingHeader: 'Welcome to Every1.fun',
          showWalletLoginFirst: false,
        },
        defaultChain: base,
        supportedChains: [base, baseSepolia],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users',
          },
          showWalletUIs: false,
        },
      }}
    >
      <AuthHandler>
        <SmartAccountProvider>
          {children}
        </SmartAccountProvider>
      </AuthHandler>
    </PrivyProvider>
  );
}