
import { Token, CreateTokenDto, UpdateTokenDto } from '../../types/token';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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
  }
};
