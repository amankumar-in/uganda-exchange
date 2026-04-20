/**
 * Orders API client.
 * File is still named coinbase.ts for import-path stability; Coinbase integration
 * has been removed and all endpoints here talk to the internal /orders backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Types shared with the exchange UI
export interface CoinbaseCandle {
  start: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface InternalOrder {
  id: string;
  transactionId: string;
  productId: string;
  asset: string;
  quote: string;
  side: 'BUY' | 'SELL';
  requestedAmount: number;
  filledAmount: number;
  price: number;
  totalValue: number;
  platformFee: number;
  exchangeFee: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  coinbaseOrderId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface OrderBook {
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

export interface PublicTrade {
  trade_id: string;
  product_id: string;
  price: string;
  size: string;
  time: string;
  side: string;
}

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`API Error [${response.status}] ${endpoint}:`, data);
      }
      throw new Error(data.message || 'Unable to process request. Please try again later.');
    }
    return data;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check your connection and try again.');
    }
    if (error instanceof Error) throw error;
    throw new Error('An unexpected error occurred. Please try again later.');
  }
}

export async function placeOrder(
  productId: string,
  side: 'BUY' | 'SELL',
  amount: number,
): Promise<{ order?: InternalOrder; success: boolean; error?: string }> {
  return Promise.resolve().then(async () => {
    try {
      const data = await apiCall<{ success: boolean; order: InternalOrder }>('/orders', {
        method: 'POST',
        body: JSON.stringify({ productId, side, amount }),
      });
      return { order: data.order, success: data.success };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unable to process trade at this time. Please try again later.',
      };
    }
  }).catch((error: any) => ({
    success: false,
    error: error?.message || 'Unable to process trade at this time. Please try again later.',
  }));
}

export async function getOrders(options?: {
  productId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ orders: InternalOrder[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.productId) params.append('productId', options.productId);
  const data = await apiCall<{ success: boolean; orders: InternalOrder[]; total: number }>(
    `/orders?${params.toString()}`,
  );
  return { orders: data.orders, total: data.total };
}

export async function getOrder(orderId: string): Promise<InternalOrder> {
  const data = await apiCall<{ success: boolean; order: InternalOrder }>(`/orders/${orderId}`);
  return data.order;
}

export async function getRevenue(): Promise<Array<{ currency: string; amount: number }>> {
  const data = await apiCall<{
    success: boolean;
    revenue: Array<{ currency: string; amount: number }>;
  }>('/orders/revenue');
  return data.revenue;
}

export function getCryptoIconUrl(symbol: string): string {
  return `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
}

export function getCryptoIconFallback(symbol: string): string {
  return `https://cryptoicons.org/api/icon/${symbol.toLowerCase()}/200`;
}
