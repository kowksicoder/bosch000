import { Request, Response, NextFunction } from 'express';
import { PrivyClient } from '@privy-io/server-auth';

const privyAppId = process.env.VITE_PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;

let privyClient: PrivyClient | null = null;

if (privyAppId && privyAppSecret) {
  privyClient = new PrivyClient(privyAppId, privyAppSecret);
  console.log('✅ Privy authentication middleware initialized');
} else {
  console.warn('⚠️ Privy credentials not found. Authentication will not work.');
}

export interface AuthenticatedRequest extends Request {
  authenticated: boolean;
  user?: {
    id: string;
    wallet?: {
      address: string;
    };
  };
}

export async function privyAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authReq = req as AuthenticatedRequest;
  
  // Try to get Privy token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No auth header, continue as unauthenticated
    authReq.authenticated = false;
    return next();
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  if (!privyClient) {
    console.error('Privy client not initialized');
    authReq.authenticated = false;
    return next();
  }

  try {
    // Verify the Privy access token
    const verifiedClaims = await privyClient.verifyAuthToken(token);
    
    // Set authenticated user info
    authReq.authenticated = true;
    authReq.user = {
      id: verifiedClaims.userId,
      wallet: {
        address: verifiedClaims.userId // Privy userId is typically the wallet address
      }
    };
    
    next();
  } catch (error) {
    // Token verification failed, continue as unauthenticated
    console.error('Privy token verification failed:', error);
    authReq.authenticated = false;
    next();
  }
}

// Optional middleware for wallet-based authentication (no Privy token needed)
// This allows direct wallet address to be passed for certain endpoints
export function walletAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authReq = req as AuthenticatedRequest;
  
  // Check if wallet address is in the request body, query, params, or custom header
  const address = req.body?.address || 
                  req.query?.address || 
                  req.params?.address ||
                  req.headers['x-wallet-address'];
  
  // Debug logging
  console.log(`[Wallet Auth] ${req.method} ${req.path}`, {
    body: req.body?.address,
    query: req.query?.address,
    params: req.params?.address,
    header: req.headers['x-wallet-address'],
    found: !!address
  });
  
  if (address) {
    authReq.authenticated = true;
    authReq.user = {
      id: address as string,
      wallet: {
        address: address as string
      }
    };
  } else {
    authReq.authenticated = false;
  }
  
  next();
}
