import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values with smart precision:
 * - For values >= $1B: show in Billions (e.g., $1.23B)
 * - For values >= $1M: show in Millions (e.g., $4.56M)
 * - For values >= $1K: show in Thousands (e.g., $7.89K)
 * - For values < $1K: show 2 decimal places (e.g., $123.45)
 */
export function formatSmartCurrency(value: number | string | null | undefined): string {
  // Handle null, undefined, or non-numeric values
  if (value == null || value === '') return "₦0.00";

  // Convert string to number if needed
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Handle NaN or invalid numbers
  if (isNaN(numValue)) return "₦0.00";

  if (numValue >= 1_000_000_000) {
    return `₦${(numValue / 1_000_000_000).toFixed(2)}B`;
  }
  if (numValue >= 1_000_000) {
    return `₦${(numValue / 1_000_000).toFixed(2)}M`;
  }
  if (numValue >= 1_000) {
    return `₦${(numValue / 1_000).toFixed(2)}K`;
  }
  return `₦${numValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format Zora coin supply with proper decimals
export function formatCoinSupply(supply: string | number): string {
  const supplyNum = typeof supply === 'string' ? parseFloat(supply) : supply;
  if (supplyNum >= 1_000_000_000) {
    return `${(supplyNum / 1_000_000_000).toFixed(2)}B`;
  }
  if (supplyNum >= 1_000_000) {
    return `${(supplyNum / 1_000_000).toFixed(2)}M`;
  }
  if (supplyNum >= 1_000) {
    return `${(supplyNum / 1_000).toFixed(2)}K`;
  }
  return supplyNum.toFixed(2);
}

// Format price change percentage
export function formatPriceChange(change: number): string {
  const prefix = change >= 0 ? '+' : '';
  return `${prefix}${change.toFixed(2)}%`;
}

// Parse Zora token amount (considering 18 decimals)
export function parseZoraTokenAmount(amount: string): string {
  const value = parseFloat(amount) / Math.pow(10, 18);
  return value.toFixed(6);
}