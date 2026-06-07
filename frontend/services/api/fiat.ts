/**
 * Fiat (UGX) deposits via Pesapal.
 */

import { getApiBaseUrl } from './config';
const API_BASE_URL = getApiBaseUrl();

export interface CreateDepositResponse {
  orderId: string;           // our internal FiatTransaction id
  redirectUrl: string;       // URL to redirect user for payment
}

export interface DepositStatusResponse {
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount: number;
  balance: number;
}

export interface DepositRecord {
  id: string;
  transactionId: string | null;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  reference: string | null;
  createdAt: string;
}

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

export function createDepositOrder(amount: number): Promise<CreateDepositResponse> {
  return apiCall<CreateDepositResponse>('/fiat/deposit', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export function getDepositStatus(orderId: string): Promise<DepositStatusResponse> {
  return apiCall<DepositStatusResponse>(`/fiat/deposit/status/${orderId}`);
}

export async function getDeposits(): Promise<DepositRecord[]> {
  const res = await apiCall<{ deposits: DepositRecord[] }>('/fiat/deposits');
  return res.deposits;
}
