import axios from "axios";

export type FxRates = {
  usd_ngn: number;
  eth_usd: number;
  eth_ngn: number;
  timestamp: number;
  source: string;
};

const CACHE_TTL_MS = 60_000;
let cachedRates: FxRates | null = null;

const fallbackUsdNgn = Number(process.env.FX_USD_NGN_FALLBACK || "1500");
const fallbackEthUsd = Number(process.env.FX_ETH_USD_FALLBACK || "3600");

async function fetchEthUsd(): Promise<number> {
  const response = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price",
    {
      params: {
        ids: "ethereum",
        vs_currencies: "usd",
      },
      timeout: 8000,
    },
  );

  const price = response.data?.ethereum?.usd;
  if (!price || Number.isNaN(Number(price))) {
    throw new Error("Invalid ETH/USD response");
  }

  return Number(price);
}

async function fetchUsdNgn(): Promise<number> {
  const response = await axios.get("https://api.exchangerate.host/latest", {
    params: {
      base: "USD",
      symbols: "NGN",
    },
    timeout: 8000,
  });

  const rate = response.data?.rates?.NGN;
  if (!rate || Number.isNaN(Number(rate))) {
    throw new Error("Invalid USD/NGN response");
  }

  return Number(rate);
}

export async function getFxRates(): Promise<FxRates> {
  if (cachedRates && Date.now() - cachedRates.timestamp < CACHE_TTL_MS) {
    return cachedRates;
  }

  try {
    const [ethUsd, usdNgn] = await Promise.all([
      fetchEthUsd(),
      fetchUsdNgn(),
    ]);

    cachedRates = {
      eth_usd: ethUsd,
      usd_ngn: usdNgn,
      eth_ngn: ethUsd * usdNgn,
      timestamp: Date.now(),
      source: "live",
    };

    return cachedRates;
  } catch (error) {
    const fallback = {
      eth_usd: fallbackEthUsd,
      usd_ngn: fallbackUsdNgn,
      eth_ngn: fallbackEthUsd * fallbackUsdNgn,
      timestamp: Date.now(),
      source: "fallback",
    };

    cachedRates = fallback;
    return fallback;
  }
}
