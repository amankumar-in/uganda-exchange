/**
 * P2P OTC Marketplace API Service
 * Handles all P2P-related API calls
 */

import { getApiBaseUrl } from './config';
const API_BASE_URL = getApiBaseUrl();

// ============================================
// TYPES
// ============================================

export type PaymentMethodType =
  | 'BANK_TRANSFER'
  | 'UPI'
  | 'PAYPAL'
  | 'VENMO'
  | 'ZELLE'
  | 'CASH_APP'
  | 'WISE'
  | 'REVOLUT'
  | 'OTHER';

export type AdSide = 'BUY' | 'SELL';
export type AdStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED';
export type TradeStatus = 'CREATED' | 'PAID' | 'DISPUTED' | 'RELEASED' | 'REFUNDED' | 'CANCELLED' | 'EXPIRED';
export type EscrowStatus = 'LOCKED' | 'RELEASED' | 'UNLOCKED';
export type DisputeStatus = 'OPEN' | 'RESOLVED';
export type DisputeOutcome = 'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER';

export interface PaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  name: string;
  details: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface P2PAd {
  id: string;
  userId: string;
  user?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  side: AdSide;
  asset: string;
  fiatCurrency: string;
  price: number;          // Price per unit
  totalQty: number;       // Total quantity
  remainingQty: number;   // Remaining quantity
  minQty: number;         // Min per trade
  maxQty: number;         // Max per trade
  terms?: string;
  status: AdStatus;
  paymentMethods: AdPaymentMethod[];
  createdAt: string;
  updatedAt: string;
}

// Backend returns flattened payment method info (not the full P2PAdPaymentMethod relation)
export interface AdPaymentMethod {
  id: string;      // Payment method ID
  type: PaymentMethodType;
  name: string;
}

export interface P2PTrade {
  id: string;
  tradeNumber: string;
  adId: string;
  ad?: P2PAd;
  buyerUserId: string;
  buyer?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  sellerUserId: string;
  seller?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  asset: string;           // Crypto asset
  fiatCurrency: string;
  qtyCrypto: number;       // Quantity of crypto
  price: number;           // Price per unit
  notional: number;        // Fiat value (qty * price)
  paymentMethodType: PaymentMethodType; // Matches schema field name
  paymentDetails?: Record<string, unknown>; // Seller's payment details for this trade
  paymentWindowSeconds: number;
  status: TradeStatus;
  proofUrls: string[];
  proofRequired: boolean;
  expiresAt: string;
  paidAt?: string;
  releasedAt?: string;
  cancelledAt?: string;
  escrow?: P2PEscrow;
  dispute?: P2PDispute;
  createdAt: string;
  updatedAt: string;
}

export interface P2PEscrow {
  id: string;
  tradeId: string;
  asset: string;
  qtyLocked: number;
  status: EscrowStatus;
  lockedAt: string;
  releasedAt?: string;
  unlockedAt?: string;
}

export interface P2PDispute {
  id: string;
  tradeId: string;
  openedById: string;
  openedBy?: {
    email: string;
  };
  reason: string;
  evidence: string[];      // Matches schema field name (URLs to evidence files)
  status: DisputeStatus;
  outcome?: DisputeOutcome;
  resolution?: string;
  resolvedById?: string;
  resolvedBy?: {
    email: string;
  };
  openedAt: string;        // Matches schema field name
  resolvedAt?: string;
}

export interface P2PUserStats {
  dailyVolumeUsd: number;
  dailyLimitUsd: number;
  dailyRemainingUsd: number;
  strikeCount: number;
  suspendedUntil: string | null;
  totalTradesCompleted: number;
  totalTradesCancelled: number;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

// ============================================
// API HELPER
// ============================================

async function p2pApiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error: ApiError = {
      message: data.message || `Request failed: ${response.status}`,
      statusCode: response.status,
    };
    throw error;
  }

  return data;
}

// ============================================
// PAYMENT METHODS
// ============================================

export async function createPaymentMethod(data: {
  type: PaymentMethodType;
  name: string;
  details: Record<string, string>;
}): Promise<PaymentMethod> {
  return p2pApiCall('/p2p/payment-methods', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return p2pApiCall('/p2p/payment-methods', {
    method: 'GET',
  });
}

export async function updatePaymentMethod(
  id: string,
  data: {
    name?: string;
    details?: Record<string, string>;
    isActive?: boolean;
  },
): Promise<PaymentMethod> {
  return p2pApiCall(`/p2p/payment-methods/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePaymentMethod(id: string): Promise<{ message: string }> {
  return p2pApiCall(`/p2p/payment-methods/${id}`, {
    method: 'DELETE',
  });
}

// ============================================
// ADS
// ============================================

export async function createAd(data: {
  side: AdSide;
  asset: string;
  fiatCurrency: string;
  price: number;
  totalQty: number;
  minQty: number;
  maxQty: number;
  paymentMethodIds: string[];
  terms?: string;
}): Promise<P2PAd> {
  return p2pApiCall('/p2p/ads', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listAds(params?: {
  side?: AdSide;
  asset?: string;
  fiatCurrency?: string;
  limit?: number;
  offset?: number;
}): Promise<{ ads: P2PAd[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.side) searchParams.append('side', params.side);
  if (params?.asset) searchParams.append('asset', params.asset);
  if (params?.fiatCurrency) searchParams.append('fiatCurrency', params.fiatCurrency);
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.offset) searchParams.append('offset', params.offset.toString());

  const query = searchParams.toString();
  return p2pApiCall(`/p2p/ads${query ? `?${query}` : ''}`, {
    method: 'GET',
  });
}

export async function getMyAds(includeAll = false): Promise<P2PAd[]> {
  return p2pApiCall(`/p2p/ads/my${includeAll ? '?includeAll=true' : ''}`, {
    method: 'GET',
  });
}

export async function getAd(id: string): Promise<P2PAd> {
  return p2pApiCall(`/p2p/ads/${id}`, {
    method: 'GET',
  });
}

export async function updateAd(
  id: string,
  data: {
    price?: number;
    minQty?: number;
    maxQty?: number;
    paymentMethodIds?: string[];
    terms?: string;
  },
): Promise<P2PAd> {
  return p2pApiCall(`/p2p/ads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function pauseAd(id: string): Promise<P2PAd> {
  return p2pApiCall(`/p2p/ads/${id}/pause`, {
    method: 'POST',
  });
}

export async function resumeAd(id: string): Promise<P2PAd> {
  return p2pApiCall(`/p2p/ads/${id}/resume`, {
    method: 'POST',
  });
}

export async function closeAd(id: string): Promise<P2PAd> {
  return p2pApiCall(`/p2p/ads/${id}/close`, {
    method: 'POST',
  });
}

// ============================================
// TRADES
// ============================================

export async function createTrade(data: {
  adId: string;
  quantity: number;
  paymentMethodType: PaymentMethodType;
  idempotencyKey?: string;
}): Promise<P2PTrade> {
  return p2pApiCall('/p2p/trades', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listTrades(params?: {
  status?: TradeStatus | 'ALL';
  role?: 'buyer' | 'seller' | 'all';
  limit?: number;
  offset?: number;
}): Promise<{ trades: P2PTrade[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.role) searchParams.append('role', params.role);
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.offset) searchParams.append('offset', params.offset.toString());

  const query = searchParams.toString();
  return p2pApiCall(`/p2p/trades${query ? `?${query}` : ''}`, {
    method: 'GET',
  });
}

export async function getTrade(id: string): Promise<P2PTrade> {
  return p2pApiCall(`/p2p/trades/${id}`, {
    method: 'GET',
  });
}

export async function uploadProof(
  tradeId: string,
  proofUrl: string,
): Promise<P2PTrade> {
  return p2pApiCall(`/p2p/trades/${tradeId}/proof`, {
    method: 'POST',
    body: JSON.stringify({ proofUrl }),
  });
}

export async function markPaid(
  tradeId: string,
  idempotencyKey?: string,
): Promise<P2PTrade> {
  return p2pApiCall(`/p2p/trades/${tradeId}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey: idempotencyKey || crypto.randomUUID() }),
  });
}

export async function cancelTrade(
  tradeId: string,
  idempotencyKey?: string,
): Promise<P2PTrade> {
  return p2pApiCall(`/p2p/trades/${tradeId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey: idempotencyKey || crypto.randomUUID() }),
  });
}

export async function releaseTrade(
  tradeId: string,
  idempotencyKey?: string,
): Promise<P2PTrade> {
  return p2pApiCall(`/p2p/trades/${tradeId}/release`, {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey: idempotencyKey || crypto.randomUUID() }),
  });
}

// ============================================
// DISPUTES
// ============================================

export async function openDispute(
  tradeId: string,
  data: {
    reason: string;
    evidence?: string[];  // Matches backend DTO field name
  },
): Promise<P2PDispute> {
  return p2pApiCall(`/p2p/trades/${tradeId}/dispute`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function resolveDispute(
  tradeId: string,
  data: {
    outcome: DisputeOutcome;
    resolution: string;
  },
): Promise<{ trade: P2PTrade; dispute: P2PDispute }> {
  return p2pApiCall(`/p2p/trades/${tradeId}/dispute/resolve`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================
// USER STATS
// ============================================

export async function getUserStats(): Promise<P2PUserStats> {
  return p2pApiCall('/p2p/stats', {
    method: 'GET',
  });
}

// ============================================
// ADMIN
// ============================================

export async function expireUnpaidTrades(): Promise<{ message: string; expiredCount: number }> {
  return p2pApiCall('/p2p/admin/expire-trades', {
    method: 'POST',
  });
}

// ============================================
// HELPERS
// ============================================

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  UPI: 'UPI',
  PAYPAL: 'PayPal',
  VENMO: 'Venmo',
  ZELLE: 'Zelle',
  CASH_APP: 'Cash App',
  WISE: 'Wise',
  REVOLUT: 'Revolut',
  OTHER: 'Other',
};

export const TRADE_STATUS_CONFIG: Record<TradeStatus, { color: string; label: string }> = {
  CREATED: { color: 'warning', label: 'Awaiting Payment' },
  PAID: { color: 'processing', label: 'Payment Marked' },
  DISPUTED: { color: 'error', label: 'Disputed' },
  RELEASED: { color: 'success', label: 'Completed' },
  REFUNDED: { color: 'default', label: 'Refunded' },
  CANCELLED: { color: 'default', label: 'Cancelled' },
  EXPIRED: { color: 'default', label: 'Expired' },
};

export const AD_STATUS_CONFIG: Record<AdStatus, { color: string; label: string }> = {
  ACTIVE: { color: 'success', label: 'Active' },
  PAUSED: { color: 'warning', label: 'Paused' },
  CLOSED: { color: 'default', label: 'Closed' },
};

export const ESCROW_STATUS_CONFIG: Record<EscrowStatus, { color: string; label: string }> = {
  LOCKED: { color: 'warning', label: 'Locked' },
  RELEASED: { color: 'success', label: 'Released' },
  UNLOCKED: { color: 'default', label: 'Unlocked' },
};

export function getPaymentMethodFields(type: PaymentMethodType): { key: string; label: string; required: boolean }[] {
  switch (type) {
    case 'BANK_TRANSFER':
      return [
        { key: 'bankName', label: 'Bank Name', required: true },
        { key: 'accountName', label: 'Account Holder Name', required: true },
        { key: 'accountNumber', label: 'Account Number', required: true },
        { key: 'routingNumber', label: 'Routing Number', required: false },
        { key: 'swiftCode', label: 'SWIFT/BIC Code', required: false },
      ];
    case 'UPI':
      return [
        { key: 'upiId', label: 'UPI ID', required: true },
        { key: 'name', label: 'Name', required: true },
      ];
    case 'PAYPAL':
      return [
        { key: 'email', label: 'PayPal Email', required: true },
      ];
    case 'VENMO':
      return [
        { key: 'username', label: 'Venmo Username', required: true },
      ];
    case 'ZELLE':
      return [
        { key: 'email', label: 'Email or Phone', required: true },
        { key: 'name', label: 'Registered Name', required: true },
      ];
    case 'CASH_APP':
      return [
        { key: 'cashtag', label: 'Cashtag', required: true },
      ];
    case 'WISE':
      return [
        { key: 'email', label: 'Wise Email', required: true },
      ];
    case 'REVOLUT':
      return [
        { key: 'username', label: 'Revolut Username', required: true },
      ];
    case 'OTHER':
      return [
        { key: 'instructions', label: 'Payment Instructions', required: true },
      ];
    default:
      return [];
  }
}

