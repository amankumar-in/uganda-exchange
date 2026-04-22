/**
 * Watchlist API Service
 * Handles all watchlist-related API calls
 */

import { getApiBaseUrl } from './config';
const API_BASE_URL = getApiBaseUrl();

export interface WatchlistItem {
  asset: string;
  addedAt: string;
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
 * Get all watchlist items for the authenticated user
 */
export async function getWatchlist(): Promise<WatchlistItem[]> {
  return apiCall<WatchlistItem[]>('/watchlist', {
    method: 'GET',
  });
}

/**
 * Add an asset to watchlist
 */
export async function addToWatchlist(asset: string): Promise<WatchlistItem> {
  return apiCall<WatchlistItem>(`/watchlist/${asset}`, {
    method: 'POST',
  });
}

/**
 * Remove an asset from watchlist
 */
export async function removeFromWatchlist(asset: string): Promise<{ success: boolean }> {
  return apiCall<{ success: boolean }>(`/watchlist/${asset}`, {
    method: 'DELETE',
  });
}

/**
 * Toggle an asset in watchlist
 */
export async function toggleWatchlist(asset: string): Promise<{ added: boolean }> {
  return apiCall<{ added: boolean }>(`/watchlist/${asset}/toggle`, {
    method: 'POST',
  });
}


