/**
 * Mining API Service
 * Handles all college coin mining API calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API request failed: ${response.status}`);
  }

  return data;
}

// ============================================
// TYPES
// ============================================

export interface MiningCollege {
  id: string;
  tokenId: string;
  symbol: string;
  name: string;
  collegeName: string | null;
  iconUrl: string | null;
  collegeLogo: string | null;
  miningBaseRate: number;
  miningSessionHours: number;
  miningAllowed: boolean;
  collegeCountry: string | null;
  addedAt: string;
}

export interface MiningSession {
  sessionId: string;
  tokenId: string;
  symbol: string;
  name: string;
  iconUrl: string | null;
  startTime: string;
  endTime: string;
  earningRate: number;
  currentTokens: number;
  remainingHours: number;
  isExpired: boolean;
}

export interface MiningBalance {
  tokenId: string;
  symbol: string;
  name: string;
  iconUrl: string | null;
  balance: number;
  availableBalance: number;
}

export interface MiningStatus {
  miningColleges: MiningCollege[];
  activeSessions: MiningSession[];
  balances: MiningBalance[];
}

export interface StartStopResult {
  tokenId: string;
  symbol: string;
  status: string;
  tokensEarned?: number;
}

// ============================================
// API FUNCTIONS
// ============================================

/** Add a college to the user's mining list */
export async function addMiningCollege(tokenId: string) {
  return apiCall<{ success: boolean; message: string; data: any }>(
    `/mining/colleges/${tokenId}`,
    { method: 'POST' },
  );
}

/** Remove a college from the user's mining list */
export async function removeMiningCollege(tokenId: string) {
  return apiCall<{ success: boolean; message: string }>(
    `/mining/colleges/${tokenId}`,
    { method: 'DELETE' },
  );
}

/** Get user's mining colleges list */
export async function getMiningColleges() {
  return apiCall<{ success: boolean; data: any[] }>(
    '/mining/colleges',
    { method: 'GET' },
  );
}

/** Start mining for a specific college */
export async function startMining(tokenId: string) {
  return apiCall<{ success: boolean; message: string; data: any }>(
    `/mining/start/${tokenId}`,
    { method: 'POST' },
  );
}

/** Stop mining for a specific college */
export async function stopMining(tokenId: string) {
  return apiCall<{ success: boolean; message: string; data: any }>(
    `/mining/stop/${tokenId}`,
    { method: 'POST' },
  );
}

/** Stop all active mining sessions */
export async function stopAllMining() {
  return apiCall<{ success: boolean; message: string; data: { stoppedCount: number; results: StartStopResult[] } }>(
    '/mining/stop-all',
    { method: 'POST' },
  );
}

/** Start mining for all colleges in list */
export async function startAllMining() {
  return apiCall<{ success: boolean; message: string; data: { startedCount: number; results: StartStopResult[] } }>(
    '/mining/start-all',
    { method: 'POST' },
  );
}

/** Get full mining status (colleges, sessions, balances) */
export async function getMiningStatus() {
  return apiCall<{ success: boolean; data: MiningStatus }>(
    '/mining/status',
    { method: 'GET' },
  );
}
