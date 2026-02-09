
import { Token, CreateTokenDto, UpdateTokenDto, GlobalAssetSettings } from '../../types/token';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Tokens API Service
 */
export const TokensApi = {
  /**
   * Get all tokens (optionally with prices)
   */
  getAll: async (includePrices = false): Promise<Token[]> => {
    const res = await fetch(`${API_BASE_URL}/tokens?includePrices=${includePrices}`);
    if (!res.ok) throw new Error('Failed to fetch tokens');
    return res.json();
  },

  /**
   * Get a single token by Symbol
   */
  getBySymbol: async (symbol: string): Promise<Token | null> => {
    const res = await fetch(`${API_BASE_URL}/tokens/symbol/${symbol}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data || null; // API might return null (204) or empty body? Controller returns object or null.
  },

  /**
   * Get a single token by ID
   */
  getOne: async (id: string): Promise<Token> => {
    const res = await fetch(`${API_BASE_URL}/tokens/${id}`);
    if (!res.ok) throw new Error('Failed to fetch token');
    return res.json();
  },

  /**
   * Create a new token
   */
  create: async (data: CreateTokenDto): Promise<Token> => {
    const res = await fetch(`${API_BASE_URL}/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create token');
    return res.json();
  },

  /**
   * Update a token
   */
  update: async (id: string, data: UpdateTokenDto): Promise<Token> => {
    const res = await fetch(`${API_BASE_URL}/tokens/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = Array.isArray(errorData.message) 
        ? errorData.message.join(', ') 
        : errorData.message || 'Failed to update token';
      throw new Error(errorMessage);
    }
    return res.json();
  },

  /**
   * Delete a token
   */
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/tokens/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete token');
  },

  /**
   * Search CoinGecko (Proxy)
   */
  searchCoinGecko: async (query: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE_URL}/tokens/search-coingecko?query=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  },

  /**
   * Get global asset settings (admin)
   */
  getGlobalSettings: async (): Promise<GlobalAssetSettings> => {
    const res = await fetch(`${API_BASE_URL}/admin/global-settings`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch global settings');
    return res.json();
  },

  /**
   * Update global asset settings (admin)
   */
  updateGlobalSettings: async (data: Partial<GlobalAssetSettings>): Promise<GlobalAssetSettings> => {
    const res = await fetch(`${API_BASE_URL}/admin/global-settings`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update global settings');
    return res.json();
  },
};
