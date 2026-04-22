import { getApiBaseUrl } from './config';
const API_BASE_URL = getApiBaseUrl();

export interface OrderBook {
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
}

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Client-side only
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'API call failed');
  return data;
}

export const getInternalOrderBook = async (productId: string): Promise<OrderBook> => {
   try {
     const data = await apiCall<{success: boolean, book: OrderBook}>(`/orders/book/${productId}`);
     return data.book;
   } catch (error) {
     console.error('Failed to fetch internal order book:', error);
     return { bids: [], asks: [] };
   }
};
