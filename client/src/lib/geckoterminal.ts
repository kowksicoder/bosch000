const GECKOTERMINAL_API_BASE = "https://api.geckoterminal.com/api/v2";

export interface GeckoTerminalPool {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    base_token_price_usd: string;
    quote_token_price_usd: string;
    pool_created_at: string;
    fdv_usd: string;
    market_cap_usd: string;
    price_change_percentage: {
      h1: string;
      h24: string;
    };
    transactions: {
      h1: {
        buys: number;
        sells: number;
      };
      h24: {
        buys: number;
        sells: number;
      };
    };
    volume_usd: {
      h1: string;
      h24: string;
    };
    reserve_in_usd: string;
  };
  relationships?: {
    base_token?: { data: { id: string; type: string } };
    quote_token?: { data: { id: string; type: string } };
    dex?: { data: { id: string; type: string } };
  };
}

export interface GeckoTerminalOHLCV {
  data: {
    id: string;
    type: string;
    attributes: {
      ohlcv_list: Array<[number, number, number, number, number, number]>; // [timestamp, open, high, low, close, volume]
    };
  };
  meta?: {
    base: {
      address: string;
      name: string;
      symbol: string;
      coingecko_coin_id: string | null;
    };
  };
}

export interface GeckoTerminalTokenPools {
  data: GeckoTerminalPool[];
  included?: Array<{
    id: string;
    type: string;
    attributes: {
      address?: string;
      name?: string;
      symbol?: string;
      image_url?: string;
    };
  }>;
}

/**
 * Search for pools by token address
 */
export async function getTokenPools(
  network: string,
  tokenAddress: string,
  page = 1
): Promise<GeckoTerminalTokenPools> {
  const response = await fetch(
    `${GECKOTERMINAL_API_BASE}/networks/${network}/tokens/${tokenAddress}/pools?page=${page}`
  );
  
  if (!response.ok) {
    throw new Error(`GeckoTerminal API error: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get specific pool data
 */
export async function getPool(
  network: string,
  poolAddress: string,
  includeTokens = true
): Promise<{ data: GeckoTerminalPool; included?: any[] }> {
  const params = includeTokens ? "?include=base_token,quote_token" : "";
  const response = await fetch(
    `${GECKOTERMINAL_API_BASE}/networks/${network}/pools/${poolAddress}${params}`
  );
  
  if (!response.ok) {
    throw new Error(`GeckoTerminal API error: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get OHLCV (candlestick) data for a pool
 */
export async function getPoolOHLCV(
  network: string,
  poolAddress: string,
  timeframe: "day" | "hour" | "minute" = "hour",
  aggregate = 1,
  limit = 100,
  currency: "usd" | "token" = "usd",
  token: "base" | "quote" = "base"
): Promise<GeckoTerminalOHLCV> {
  const response = await fetch(
    `${GECKOTERMINAL_API_BASE}/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=${currency}&token=${token}`
  );
  
  if (!response.ok) {
    throw new Error(`GeckoTerminal API error: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get multiple pools data in one call
 */
export async function getMultiplePools(
  network: string,
  poolAddresses: string[]
): Promise<{ data: GeckoTerminalPool[] }> {
  const addresses = poolAddresses.join(",");
  const response = await fetch(
    `${GECKOTERMINAL_API_BASE}/networks/${network}/pools/multi/${addresses}`
  );
  
  if (!response.ok) {
    throw new Error(`GeckoTerminal API error: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Search for a pool by token address and return the top pool
 */
export async function findTopPoolForToken(
  network: string,
  tokenAddress: string
): Promise<GeckoTerminalPool | null> {
  try {
    const result = await getTokenPools(network, tokenAddress, 1);
    
    if (result.data && result.data.length > 0) {
      return result.data[0];
    }
    
    return null;
  } catch (error) {
    console.error("Error finding pool for token:", error);
    return null;
  }
}

/**
 * Format OHLCV data for use with recharts
 */
export function formatOHLCVForChart(ohlcvData: GeckoTerminalOHLCV): Array<{
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}> {
  if (!ohlcvData.data?.attributes?.ohlcv_list) {
    return [];
  }

  return ohlcvData.data.attributes.ohlcv_list
    .filter((row) => row && row.length === 6)
    .map(([timestamp, open, high, low, close, volume]) => {
      const date = new Date(Number(timestamp) * 1000);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      return {
        time: timeStr,
        open: parseFloat(Number(open).toFixed(8)),
        high: parseFloat(Number(high).toFixed(8)),
        low: parseFloat(Number(low).toFixed(8)),
        close: parseFloat(Number(close).toFixed(8)),
        volume: parseFloat(Number(volume).toFixed(2)),
        timestamp: Number(timestamp),
      };
    });
}

/**
 * Get trending pools for a network
 */
export async function getTrendingPools(
  network: string,
  page = 1
): Promise<{ data: GeckoTerminalPool[] }> {
  const response = await fetch(
    `${GECKOTERMINAL_API_BASE}/networks/${network}/trending_pools?page=${page}`
  );
  
  if (!response.ok) {
    throw new Error(`GeckoTerminal API error: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get recent trades for a pool
 */
export async function getPoolTrades(
  network: string,
  poolAddress: string
): Promise<any> {
  const response = await fetch(
    `${GECKOTERMINAL_API_BASE}/networks/${network}/pools/${poolAddress}/trades`
  );
  
  if (!response.ok) {
    throw new Error(`GeckoTerminal API error: ${response.statusText}`);
  }
  
  return response.json();
}
