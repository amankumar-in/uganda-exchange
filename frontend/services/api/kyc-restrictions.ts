/**
 * KYC Restrictions API Service
 * Handles admin-side KYC geographic restriction management
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ============================================
// TYPES
// ============================================

export interface AllowedState {
  id: string;
  countryId: string;
  stateCode: string;
  stateName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AllowedCountry {
  id: string;
  countryCode: string;
  countryName: string;
  isActive: boolean;
  allowAllStates: boolean;
  createdAt: string;
  updatedAt: string;
  allowedStates: AllowedState[];
}

export interface ReferenceState {
  code: string;
  name: string;
}

export interface CreateCountryPayload {
  countryCode: string;
  countryName: string;
  isActive?: boolean;
  allowAllStates?: boolean;
}

export interface UpdateCountryPayload {
  countryName?: string;
  isActive?: boolean;
  allowAllStates?: boolean;
}

export interface CreateStatePayload {
  stateCode: string;
  stateName: string;
  isActive?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

async function handleResponse<T>(response: Response): Promise<{ success: boolean; data?: T; error?: string }> {
  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.message || 'Request failed' };
  }
  return { success: true, data };
}

// ============================================
// COUNTRY ENDPOINTS
// ============================================

export async function getAllowedCountries(): Promise<{ success: boolean; countries?: AllowedCountry[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/countries`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse<{ countries: AllowedCountry[] }>(response);
    return { success: result.success, countries: result.data?.countries, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export async function getCountryWithStates(countryCode: string): Promise<{ success: boolean; country?: AllowedCountry; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/countries/${countryCode}`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse<{ country: AllowedCountry }>(response);
    return { success: result.success, country: result.data?.country, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export async function createCountry(payload: CreateCountryPayload): Promise<{ success: boolean; country?: AllowedCountry; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/countries`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await handleResponse<{ country: AllowedCountry }>(response);
    return { success: result.success, country: result.data?.country, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export async function updateCountry(countryCode: string, payload: UpdateCountryPayload): Promise<{ success: boolean; country?: AllowedCountry; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/countries/${countryCode}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await handleResponse<{ country: AllowedCountry }>(response);
    return { success: result.success, country: result.data?.country, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export async function deleteCountry(countryCode: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/countries/${countryCode}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const result = await handleResponse<void>(response);
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export async function toggleCountry(countryCode: string, isActive: boolean): Promise<{ success: boolean; country?: AllowedCountry; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/countries/${countryCode}/toggle`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const result = await handleResponse<{ country: AllowedCountry }>(response);
    return { success: result.success, country: result.data?.country, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

// ============================================
// STATE ENDPOINTS
// ============================================

export async function getStatesForCountry(countryCode: string): Promise<{ success: boolean; states?: AllowedState[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/countries/${countryCode}/states`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse<{ states: AllowedState[] }>(response);
    return { success: result.success, states: result.data?.states, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export async function addStates(countryCode: string, states: CreateStatePayload[]): Promise<{ success: boolean; states?: AllowedState[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/countries/${countryCode}/states`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ states }),
    });
    const result = await handleResponse<{ states: AllowedState[] }>(response);
    return { success: result.success, states: result.data?.states, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export async function toggleState(stateId: string, isActive: boolean): Promise<{ success: boolean; state?: AllowedState; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/states/${stateId}/toggle`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const result = await handleResponse<{ state: AllowedState }>(response);
    return { success: result.success, state: result.data?.state, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export async function deleteState(stateId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/states/${stateId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const result = await handleResponse<void>(response);
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export async function bulkToggleStates(countryCode: string, stateCodes: string[], isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/countries/${countryCode}/states/bulk-toggle`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ stateCodes, isActive }),
    });
    const result = await handleResponse<void>(response);
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

// ============================================
// REFERENCE DATA
// ============================================

export async function getReferenceStates(countryCode: string): Promise<{ success: boolean; states?: ReferenceState[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/kyc-restrictions/reference-states/${countryCode}`, {
      headers: getAuthHeaders(),
    });
    const result = await handleResponse<{ states: ReferenceState[] }>(response);
    return { success: result.success, states: result.data?.states, error: result.error };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}
