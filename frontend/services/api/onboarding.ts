/**
 * Onboarding / KYC API Service
 * Handles all KYC-related API calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Types
export interface PersonalDetailsData {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
}

export interface AddressData {
  street1: string;
  street2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2 code
}

export interface KycStatus {
  currentStep: number;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  veriffStatus: string | null;
  veriffReason: string | null;
  hasPersonalDetails: boolean;
  hasAddress: boolean;
  hasVeriffSession: boolean;
}

export interface KycDetails {
  id: string;
  currentStep: number;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  personalDetails: {
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
  };
  address: {
    street1: string | null;
    street2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
  };
  verification: {
    sessionId: string | null;
    status: string | null;
    reason: string | null;
    decisionTime: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface VeriffSession {
  sessionId: string;
  sessionUrl?: string;
  sessionToken?: string;
  message?: string;
}

export interface VeriffDecision {
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  veriffStatus: string;
  reason: string | null;
}

export interface ApiResponse {
  message: string;
  currentStep?: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) {
      (defaultHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error: ApiError = {
      message: data.message || 'An error occurred',
      statusCode: response.status,
      errors: data.errors,
    };
    throw error;
  }

  return data as T;
}

// Onboarding API Functions

/**
 * Get current KYC status
 */
export async function getKycStatus(): Promise<KycStatus> {
  return apiCall<KycStatus>('/onboarding/status', {
    method: 'GET',
  });
}

/**
 * Get full KYC details
 */
export async function getKycDetails(): Promise<KycDetails | null> {
  return apiCall<KycDetails | null>('/onboarding/details', {
    method: 'GET',
  });
}

/**
 * Save personal details (Step 1)
 */
export async function savePersonalDetails(data: PersonalDetailsData): Promise<ApiResponse> {
  return apiCall<ApiResponse>('/onboarding/personal', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Save address (Step 2)
 */
export async function saveAddress(data: AddressData): Promise<ApiResponse> {
  return apiCall<ApiResponse>('/onboarding/address', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Create Veriff verification session (Step 3)
 */
export async function createVeriffSession(): Promise<VeriffSession> {
  return apiCall<VeriffSession>('/onboarding/veriff/session', {
    method: 'POST',
  });
}

/**
 * Check Veriff decision (polling)
 */
export async function checkVeriffDecision(): Promise<VeriffDecision> {
  return apiCall<VeriffDecision>('/onboarding/veriff/decision', {
    method: 'GET',
  });
}

