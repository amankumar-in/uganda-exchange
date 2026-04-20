/**
 * Fiat (INR) deposits via Razorpay.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';

export interface CreateDepositResponse {
  orderId: string;           // our internal FiatTransaction id
  razorpayOrderId: string;   // Razorpay order id (passed to Checkout)
  amount: number;            // paise
  currency: string;          // "INR"
  keyId: string;             // public key id for Checkout
}

export interface VerifyDepositResponse {
  success: boolean;
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

export function verifyDepositPayment(input: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifyDepositResponse> {
  return apiCall<VerifyDepositResponse>('/fiat/deposit/verify', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getDeposits(): Promise<DepositRecord[]> {
  const res = await apiCall<{ deposits: DepositRecord[] }>('/fiat/deposits');
  return res.deposits;
}
