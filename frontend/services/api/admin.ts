/**
 * Admin API Service
 * Handles all admin-related API calls
 */

import { getApiBaseUrl } from './config';
const API_BASE_URL = getApiBaseUrl();

// ============================================
// TYPES
// ============================================

export interface AdminUser {
  id: string;
  email: string;
  phone: string;
  phoneCountry: string;
  country: string;
  role: 'USER' | 'ADMIN';
  appMode: 'LEARNER' | 'INVESTOR';
  kycStatus: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
  firstName: string | null;
  lastName: string | null;
}

export interface AdminUserKyc {
  id: string;
  consentedAt: string | null;
  pan: string | null;
  panName: string | null;
  panDob: string | null;
  panStatus: string | null;
  panNameMatch: boolean | null;
  panDobMatch: boolean | null;
  panAadhaarSeeding: string | null;
  panVerifiedAt: string | null;
  aadhaarLast4: string | null;
  aadhaarName: string | null;
  aadhaarDob: string | null;
  aadhaarYob: string | null;
  aadhaarGender: string | null;
  aadhaarCareOf: string | null;
  aadhaarPhotoUrl: string | null;
  aadhaarVerifiedAt: string | null;
  panAadhaarLinked: boolean | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  selfieUrl: string | null;
  selfieUploadedAt: string | null;
  currentStep: number;
  status: string;
  rejectionReason: string | null;
  autoDecidedAt: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserNotificationPreferences {
  emailMarketing: boolean;
  emailSecurityAlerts: boolean;
  emailTransactions: boolean;
  emailPriceAlerts: boolean;
  emailNewsUpdates: boolean;
  pushEnabled: boolean;
  pushSecurityAlerts: boolean;
  pushTransactions: boolean;
  pushPriceAlerts: boolean;
  pushNewsUpdates: boolean;
  smsEnabled: boolean;
  smsSecurityAlerts: boolean;
  smsTransactions: boolean;
}

export interface AdminUserBankAccount {
  id: string;
  accountName: string;
  accountType: string;
  accountNumber: string;
  isVerified: boolean;
  createdAt: string;
}

export interface FullAdminUser extends AdminUser {
  kyc: AdminUserKyc | null;
  notificationPreferences: AdminUserNotificationPreferences | null;
  bankAccounts: AdminUserBankAccount[];
  _count: {
    trades: number;
    fiatTransactions: number;
    cryptoTransactions: number;
    learnerTrades: number;
  };
}

export interface BalanceItem {
  asset: string;
  balance: number;
  availableBalance: number;
  lockedBalance: number;
}

export interface UserBalances {
  live: BalanceItem[];
  learner: {
    fiat: BalanceItem | null;
    crypto: BalanceItem[];
  };
}

export interface TransactionItem {
  id: string;
  transactionId: string | null;
  type: string;
  method: string;
  amount: number;
  status: string;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeItem {
  id: string;
  transactionId: string | null;
  productId: string;
  asset: string;
  quote: string;
  side: string;
  requestedAmount: number;
  filledAmount: number;
  price: number;
  totalValue: number;
  platformFee: number;
  exchangeFee: number;
  status: string;
  coinbaseOrderId: string | null;
  createdAt: string;
  completedAt: string | null;
  isSimulated?: boolean;
}

export interface DemoCollegeCoin {
  id: string;
  ticker: string;
  name: string;
  iconUrl: string | null;
  peggedToAsset: string;
  peggedPercentage: number;
  isActive: boolean;
  description: string | null;
  website: string | null;
  whitepaper: string | null;
  twitter: string | null;
  discord: string | null;
  categories: string[];
  genesisDate: string | null;
  createdAt: string;
  updatedAt: string;
  currentPrice?: number;
  referencePrice?: number;
}

export interface ReferenceToken {
  symbol: string;
  name: string;
}

export interface MediaFile {
  filename: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'file';
  size: number;
  url: string;
  createdAt: string;
  modifiedAt?: string;
  originalName?: string;
  mimetype?: string;
  uploadedAt?: string;
}

// ============================================
// API HELPER
// ============================================

async function adminApiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const headers: HeadersInit = {
    ...(options.headers || {}),
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  // Don't set Content-Type for FormData (browser will set it with boundary)
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `API request failed: ${response.status}`);
    }

    return data;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Backend server is not running.');
    }
    throw error;
  }
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Get paginated list of users
 */
export async function getUsers(options?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  kycStatus?: string;
}): Promise<{
  success: boolean;
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.search) params.append('search', options.search);
  if (options?.role) params.append('role', options.role);
  if (options?.kycStatus) params.append('kycStatus', options.kycStatus);

  const queryString = params.toString();
  return adminApiCall(`/admin/users${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Get single user full details
 */
export async function getUser(id: string): Promise<{
  success: boolean;
  user: FullAdminUser;
}> {
  return adminApiCall(`/admin/users/${id}`, {
    method: 'GET',
  });
}

/**
 * Update user role
 */
export async function updateUserRole(
  id: string,
  role: 'USER' | 'ADMIN',
): Promise<{
  success: boolean;
  user: AdminUser;
  message: string;
}> {
  return adminApiCall(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

/**
 * Update user fields
 */
export async function updateUser(
  id: string,
  data: {
    emailVerified?: boolean;
    phoneVerified?: boolean;
    appMode?: 'LEARNER' | 'INVESTOR';
    role?: 'USER' | 'ADMIN';
  },
): Promise<{
  success: boolean;
  user: AdminUser;
  message: string;
}> {
  return adminApiCall(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<{
  success: boolean;
  message: string;
}> {
  return adminApiCall(`/admin/users/${id}`, {
    method: 'DELETE',
  });
}

// ============================================
// USER BALANCES
// ============================================

/**
 * Get user balances (live + learner)
 */
export async function getUserBalances(userId: string): Promise<{
  success: boolean;
  balances: UserBalances;
}> {
  return adminApiCall(`/admin/users/${userId}/balances`, {
    method: 'GET',
  });
}

/**
 * Adjust user balance
 */
export async function adjustUserBalance(
  userId: string,
  data: {
    asset: string;
    amount: number;
    reason?: string;
    mode: 'live' | 'learner';
  },
): Promise<{
  success: boolean;
  newBalance: BalanceItem;
  message: string;
}> {
  return adminApiCall(`/admin/users/${userId}/balance-adjustment`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================
// USER TRANSACTIONS
// ============================================

/**
 * Get user transactions
 */
export async function getUserTransactions(
  userId: string,
  options?: {
    page?: number;
    limit?: number;
    type?: 'DEPOSIT' | 'WITHDRAWAL';
    status?: string;
  },
): Promise<{
  success: boolean;
  transactions: TransactionItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.type) params.append('type', options.type);
  if (options?.status) params.append('status', options.status);

  const queryString = params.toString();
  return adminApiCall(`/admin/users/${userId}/transactions${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  userId: string,
  transactionId: string,
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
): Promise<{
  success: boolean;
  transaction: TransactionItem;
  message: string;
}> {
  return adminApiCall(`/admin/users/${userId}/transactions/${transactionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ============================================
// USER TRADES
// ============================================

/**
 * Get user trades
 */
export async function getUserTrades(
  userId: string,
  options?: {
    page?: number;
    limit?: number;
    mode?: 'live' | 'learner' | 'all';
    status?: string;
  },
): Promise<{
  success: boolean;
  trades: TradeItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.mode) params.append('mode', options.mode);
  if (options?.status) params.append('status', options.status);

  const queryString = params.toString();
  return adminApiCall(`/admin/users/${userId}/trades${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

// ============================================
// KYC MANAGEMENT
// ============================================

/**
 * Update KYC status
 */
export async function updateKycStatus(
  userId: string,
  data: {
    status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    reviewNotes?: string;
  },
): Promise<{
  success: boolean;
  kyc: {
    id: string;
    status: string;
    reviewNotes: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
  };
  message: string;
}> {
  return adminApiCall(`/admin/users/${userId}/kyc`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ============================================
// LEARNER ACCOUNT
// ============================================

/**
 * Reset learner account
 */
export async function resetLearnerAccount(userId: string): Promise<{
  success: boolean;
  message: string;
}> {
  return adminApiCall(`/admin/users/${userId}/learner/reset`, {
    method: 'POST',
  });
}

// ============================================
// DEMO COLLEGE COINS MANAGEMENT
// ============================================

/**
 * Get reference tokens for pegging
 */
export async function getReferenceTokens(): Promise<{
  success: boolean;
  tokens: ReferenceToken[];
}> {
  return adminApiCall('/admin/demo-college-coins/reference-tokens', {
    method: 'GET',
  });
}

/**
 * Get all demo college coins (including inactive)
 */
export async function getCollegeCoins(): Promise<{
  success: boolean;
  coins: DemoCollegeCoin[];
}> {
  return adminApiCall('/admin/demo-college-coins', {
    method: 'GET',
  });
}

/**
 * Get single demo college coin
 */
export async function getCollegeCoin(id: string): Promise<{
  success: boolean;
  coin: DemoCollegeCoin;
}> {
  return adminApiCall(`/admin/demo-college-coins/${id}`, {
    method: 'GET',
  });
}

/**
 * Create a new demo college coin
 */
export async function createCollegeCoin(data: {
  ticker: string;
  name: string;
  peggedToAsset: string;
  peggedPercentage: number;
  isActive?: boolean;
  description?: string;
  website?: string;
  whitepaper?: string;
  twitter?: string;
  discord?: string;
  categories?: string[];
  genesisDate?: string;
  icon?: File;
  iconUrl?: string; // URL from media library or external URL
}): Promise<{
  success: boolean;
  coin: DemoCollegeCoin;
  message: string;
}> {
  const formData = new FormData();
  formData.append('ticker', data.ticker);
  formData.append('name', data.name);
  formData.append('peggedToAsset', data.peggedToAsset);
  formData.append('peggedPercentage', data.peggedPercentage.toString());
  formData.append('isActive', (data.isActive ?? true).toString());
  
  if (data.description) formData.append('description', data.description);
  if (data.website) formData.append('website', data.website);
  if (data.whitepaper) formData.append('whitepaper', data.whitepaper);
  if (data.twitter) formData.append('twitter', data.twitter);
  if (data.discord) formData.append('discord', data.discord);
  if (data.categories) formData.append('categories', JSON.stringify(data.categories));
  if (data.genesisDate) formData.append('genesisDate', data.genesisDate);
  if (data.icon) formData.append('icon', data.icon);
  if (data.iconUrl && !data.icon) formData.append('iconUrl', data.iconUrl);

  return adminApiCall('/admin/demo-college-coins', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Update a demo college coin
 */
export async function updateCollegeCoin(
  id: string,
  data: {
    ticker?: string;
    name?: string;
    peggedToAsset?: string;
    peggedPercentage?: number;
    isActive?: boolean;
    description?: string;
    website?: string;
    whitepaper?: string;
    twitter?: string;
    discord?: string;
    categories?: string[];
    genesisDate?: string;
    icon?: File;
    iconUrl?: string; // URL from media library or external URL
  },
): Promise<{
  success: boolean;
  coin: DemoCollegeCoin;
  message: string;
}> {
  const formData = new FormData();
  
  if (data.ticker) formData.append('ticker', data.ticker);
  if (data.name) formData.append('name', data.name);
  if (data.peggedToAsset) formData.append('peggedToAsset', data.peggedToAsset);
  if (data.peggedPercentage !== undefined) formData.append('peggedPercentage', data.peggedPercentage.toString());
  if (data.isActive !== undefined) formData.append('isActive', data.isActive.toString());
  if (data.description !== undefined) formData.append('description', data.description);
  if (data.website !== undefined) formData.append('website', data.website);
  if (data.whitepaper !== undefined) formData.append('whitepaper', data.whitepaper);
  if (data.twitter !== undefined) formData.append('twitter', data.twitter);
  if (data.discord !== undefined) formData.append('discord', data.discord);
  if (data.categories !== undefined) formData.append('categories', JSON.stringify(data.categories));
  if (data.genesisDate !== undefined) formData.append('genesisDate', data.genesisDate);
  if (data.icon) formData.append('icon', data.icon);
  if (data.iconUrl && !data.icon) formData.append('iconUrl', data.iconUrl);

  return adminApiCall(`/admin/demo-college-coins/${id}`, {
    method: 'PATCH',
    body: formData,
  });
}

/**
 * Delete a demo college coin
 */
export async function deleteCollegeCoin(id: string): Promise<{
  success: boolean;
  message: string;
}> {
  return adminApiCall(`/admin/demo-college-coins/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Import demo college coins from CSV
 */
export async function importCollegeCoins(file: File): Promise<{
  success: boolean;
  message: string;
  results: {
    total: number;
    created: number;
    failed: number;
    errors: { row: number; ticker: string; error: string }[];
  };
}> {
  const formData = new FormData();
  formData.append('file', file);

  return adminApiCall('/admin/demo-college-coins/import', {
    method: 'POST',
    body: formData,
  });
}

// ============================================
// MEDIA MANAGER
// ============================================

/**
 * Upload multiple files to media manager
 */
export async function uploadMedia(files: File[]): Promise<{
  success: boolean;
  message: string;
  files: MediaFile[];
}> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  return adminApiCall('/admin/media/upload', {
    method: 'POST',
    body: formData,
  });
}

/**
 * List all files in media manager
 */
export async function listMedia(): Promise<{
  success: boolean;
  files: MediaFile[];
  total: number;
}> {
  return adminApiCall('/admin/media', {
    method: 'GET',
  });
}

/**
 * Get single file details
 */
export async function getMediaFile(filename: string): Promise<{
  success: boolean;
  file: MediaFile;
}> {
  return adminApiCall(`/admin/media/${encodeURIComponent(filename)}`, {
    method: 'GET',
  });
}

/**
 * Delete a file from media manager
 */
export async function deleteMediaFile(filename: string): Promise<{
  success: boolean;
  message: string;
}> {
  return adminApiCall(`/admin/media/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
}

// ============================================
// PLATFORM TRANSACTIONS
// ============================================

export interface PlatformTransaction {
  id: string;
  transactionId: string | null;
  txnType: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL';
  category: 'trade' | 'fiat';
  asset: string;
  quote: string | null;
  productId: string | null;
  amount: number;
  filledAmount: number | null;
  price: number | null;
  totalValue: number;
  platformFee: number;
  exchangeFee: number;
  status: string;
  userId: string;
  userEmail: string;
  userPhone: string;
  coinbaseOrderId: string | null;
  method: string | null;
  reference: string | null;
  metadata: any;
  createdAt: string;
  completedAt: string | null;
}

export interface TransactionDetail {
  id: string;
  transactionId: string | null;
  txnType: string;
  category: 'trade' | 'fiat';
  asset: string;
  quote?: string;
  productId?: string;
  requestedAmount?: number;
  filledAmount?: number;
  price?: number;
  totalValue?: number;
  platformFee?: number;
  exchangeFee?: number;
  feePercent?: number;
  amount?: number;
  method?: string;
  reference?: string;
  metadata?: any;
  status: string;
  coinbaseOrderId?: string;
  user: {
    id: string;
    email: string;
    phone: string;
    phoneCountry: string;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface AssetHolding {
  asset: string;
  totalBalance: number;
  userCount: number;
}

export interface PlatformHoldings {
  fiat: AssetHolding;
  crypto: AssetHolding[];
  learnerFiat: AssetHolding;
  learnerCrypto: AssetHolding[];
  revenue: Array<{ currency: string; amount: number }>;
  totalUsers: number;
}

export interface FeeReportSummary {
  totalFees: number;
  totalTransactions: number;
  avgFeePerTxn: number;
  totalVolume: number;
  feePercentOfVolume: number;
}

export interface FeeByCurrency {
  currency: string;
  totalFees: number;
  transactionCount: number;
  avgFee: number;
}

export interface FeeTransaction {
  id: string;
  transactionId: string | null;
  txnType: string;
  asset: string;
  quote: string;
  productId: string;
  totalValue: number;
  platformFee: number;
  feePercent: number;
  status: string;
  userEmail: string;
  createdAt: string;
}

export interface FeeReport {
  summary: FeeReportSummary;
  byCurrency: FeeByCurrency[];
  transactions: FeeTransaction[];
  period: { from: string; to: string };
}

/**
 * Get all platform transactions with filters
 */
export async function getAllTransactions(options?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  asset?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<{
  success: boolean;
  transactions: PlatformTransaction[];
  total: number;
  page: number;
  limit: number;
}> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.type) params.append('type', options.type);
  if (options?.status) params.append('status', options.status);
  if (options?.asset) params.append('asset', options.asset);
  if (options?.userId) params.append('userId', options.userId);
  if (options?.dateFrom) params.append('dateFrom', options.dateFrom);
  if (options?.dateTo) params.append('dateTo', options.dateTo);
  if (options?.search) params.append('search', options.search);

  const queryString = params.toString();
  return adminApiCall(`/admin/transactions${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Get single transaction detail
 */
export async function getTransactionDetail(
  id: string,
  type: 'trade' | 'fiat',
): Promise<{
  success: boolean;
  transaction: TransactionDetail;
}> {
  return adminApiCall(`/admin/transactions/${id}?type=${type}`, {
    method: 'GET',
  });
}

/**
 * Get platform-wide holdings
 */
export async function getPlatformHoldings(): Promise<{
  success: boolean;
} & PlatformHoldings> {
  return adminApiCall('/admin/holdings', {
    method: 'GET',
  });
}

/**
 * Get transactions for a specific asset
 */
export async function getAssetTransactions(
  asset: string,
  options?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<{
  success: boolean;
  transactions: PlatformTransaction[];
  total: number;
  page: number;
  limit: number;
}> {
  const params = new URLSearchParams();
  if (options?.page) params.append('page', options.page.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.type) params.append('type', options.type);
  if (options?.status) params.append('status', options.status);
  if (options?.dateFrom) params.append('dateFrom', options.dateFrom);
  if (options?.dateTo) params.append('dateTo', options.dateTo);

  const queryString = params.toString();
  return adminApiCall(`/admin/holdings/${encodeURIComponent(asset)}/transactions${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Get fee report
 */
export async function getFeeReport(options?: {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  success: boolean;
} & FeeReport> {
  const params = new URLSearchParams();
  if (options?.period) params.append('period', options.period);
  if (options?.dateFrom) params.append('dateFrom', options.dateFrom);
  if (options?.dateTo) params.append('dateTo', options.dateTo);

  const queryString = params.toString();
  return adminApiCall(`/admin/fees${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

