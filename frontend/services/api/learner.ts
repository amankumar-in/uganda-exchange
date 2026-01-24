/**
 * Learner Mode API Service
 * Handles all learner/practice trading API calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface LearnerBalance {
  asset: string;
  balance: number;
  availableBalance: number;
  lockedBalance: number;
}

export interface LearnerOrder {
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
  isSimulated: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface PortfolioSnapshot {
  totalValue: number;
  investedValue: number;
  cashBalance: number;
  cryptoValue: number;
  snapshotDate: string;
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
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Backend server is not running. Please start the backend.');
    }
    throw error;
  }
}

/**
 * Get all learner mode balances (fiat + crypto)
 */
export async function getLearnerBalances(): Promise<{
  success: boolean;
  balances: LearnerBalance[];
}> {
  return apiCall('/learner/balances', {
    method: 'GET',
  });
}

/**
 * Reset learner account to initial state ($100,000)
 */
export async function resetLearnerAccount(): Promise<{
  success: boolean;
  message: string;
}> {
  return apiCall('/learner/reset', {
    method: 'POST',
  });
}

/**
 * Place a simulated trade in learner mode
 */
export async function placeLearnerTrade(
  productId: string,
  side: 'BUY' | 'SELL',
  amount: number,
  currentPrice: number,
): Promise<{
  success: boolean;
  order: LearnerOrder;
  isSimulatedFailure?: boolean;
}> {
  return apiCall('/learner/trade', {
    method: 'POST',
    body: JSON.stringify({
      productId,
      side,
      amount,
      currentPrice,
    }),
  });
}

/**
 * Get learner mode order history
 */
export async function getLearnerOrders(options?: {
  productId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  orders: LearnerOrder[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (options?.productId) params.append('productId', options.productId);
  if (options?.status) params.append('status', options.status);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  const queryString = params.toString();
  return apiCall(`/learner/orders${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Get a single learner order
 */
export async function getLearnerOrder(orderId: string): Promise<{
  success: boolean;
  order: LearnerOrder;
}> {
  return apiCall(`/learner/orders/${orderId}`, {
    method: 'GET',
  });
}

/**
 * Get portfolio history for growth chart
 */
export async function getPortfolioHistory(range: '1D' | '1W' | '1M' | '6M' | '1Y' = '1M'): Promise<{
  success: boolean;
  history: PortfolioSnapshot[];
  range: string;
}> {
  return apiCall(`/learner/portfolio-history?range=${range}`, {
    method: 'GET',
  });
}

/**
 * Create a portfolio snapshot with current prices
 */
export async function createPortfolioSnapshot(cryptoPrices: Record<string, number>): Promise<{
  success: boolean;
  message: string;
}> {
  return apiCall('/learner/snapshot', {
    method: 'POST',
    body: JSON.stringify({ cryptoPrices }),
  });
}


