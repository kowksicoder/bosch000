import { useQuery } from "@tanstack/react-query";

export type FxRates = {
  usd_ngn: number;
  eth_usd: number;
  eth_ngn: number;
  timestamp: number;
  source?: string;
};

async function fetchFxRates(): Promise<FxRates> {
  const response = await fetch("/api/fx/rates");
  if (!response.ok) {
    throw new Error("Failed to fetch FX rates");
  }
  return response.json();
}

export function useFxRates() {
  return useQuery({
    queryKey: ["fx-rates"],
    queryFn: fetchFxRates,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 2,
  });
}

export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

export function convertUsdToNgn(
  usdValue: number | string | null | undefined,
  rates?: FxRates,
): number | null {
  const value = toNumber(usdValue);
  if (value === null) return null;
  if (!rates) return value;
  return value * rates.usd_ngn;
}

export function convertEthToNgn(
  ethValue: number | string | null | undefined,
  rates?: FxRates,
): number | null {
  const value = toNumber(ethValue);
  if (value === null) return null;
  if (!rates) return value;
  return value * rates.eth_ngn;
}
