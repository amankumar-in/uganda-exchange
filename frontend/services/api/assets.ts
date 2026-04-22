/**
 * Assets API Service
 * Handles all balance-related API calls
 */

import { getApiBaseUrl } from './config';
const API_BASE_URL = getApiBaseUrl();

export interface Balance {
  asset: string;
  balance: number;
  availableBalance: number;
  lockedBalance: number;
  usdValue?: number;
}

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`API Error [${response.status}] ${endpoint}:`, data);
      throw new Error(data.message || `API request failed: ${response.status}`);
    }

    return data;
  } catch (error: any) {
    // Network error or JSON parse error
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Backend server is not running. Please start the backend.');
    }
    throw error;
  }
}

/**
 * Get all crypto balances for the authenticated user
 */
export async function getBalances(): Promise<Balance[]> {
  return apiCall<Balance[]>('/assets', {
    method: 'GET',
  });
}

/**
 * Get balance for a specific asset
 */
export async function getBalance(asset: string): Promise<Balance> {
  return apiCall<Balance>(`/assets/${asset}`, {
    method: 'GET',
  });
}

// ============================================
// PORTFOLIO SNAPSHOTS (Investor Mode)
// ============================================

export interface PortfolioSnapshot {
  totalValue: number;
  investedValue: number;
  cashBalance: number;
  cryptoValue: number;
  snapshotDate: string;
}

/**
 * Get portfolio history for investor mode growth chart
 */
export async function getInvestorPortfolioHistory(range: '1D' | '1W' | '1M' | '6M' | '1Y' = '1M'): Promise<{
  success: boolean;
  history: PortfolioSnapshot[];
  range: string;
}> {
  return apiCall(`/assets/portfolio/history?range=${range}`, {
    method: 'GET',
  });
}

/**
 * Create a portfolio snapshot for investor mode
 */
export async function createInvestorPortfolioSnapshot(cryptoPrices: Record<string, number>): Promise<{
  success: boolean;
  message: string;
}> {
  return apiCall('/assets/portfolio/snapshot', {
    method: 'POST',
    body: JSON.stringify({ cryptoPrices }),
  });
}

