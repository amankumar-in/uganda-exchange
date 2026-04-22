/**
 * Onboarding / KYC API Service — India (Sandbox.co.in)
 */

import { getApiBaseUrl } from './config';
const API_BASE_URL = getApiBaseUrl();

// ============================================
// TYPES
// ============================================

export type KycDecisionStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface KycStatus {
  currentStep: number;
  status: KycDecisionStatus;
  hasConsent: boolean;
  hasPan: boolean;
  hasAadhaar: boolean;
  hasAadhaarRefId: boolean;
  hasAddress: boolean;
  hasSelfie: boolean;
  rejectionReason: string | null;
  aadhaarLast4: string | null;
  panMasked: string | null;
}

export interface KycDetails {
  id: string;
  currentStep: number;
  status: KycDecisionStatus;
  consent: { consentedAt: string | null };
  pan: {
    pan: string | null;
    panName: string | null;
    panStatus: string | null;
    panNameMatch: boolean | null;
    panDobMatch: boolean | null;
    panVerifiedAt: string | null;
  };
  aadhaar: {
    aadhaarLast4: string | null;
    aadhaarName: string | null;
    aadhaarDob: string | null;
    aadhaarGender: string | null;
    aadhaarCareOf: string | null;
    aadhaarPhotoUrl: string | null;
    aadhaarVerifiedAt: string | null;
  };
  address: {
    street1: string | null;
    street2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
  };
  selfie: {
    selfieUrl: string | null;
    selfieUploadedAt: string | null;
  };
  panAadhaarLinked: boolean | null;
  rejectionReason: string | null;
  autoDecidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PanVerifyData {
  pan: string;
  nameAsPerPan: string;
  dateOfBirth: string; // YYYY-MM-DD
}

export interface AddressData {
  street1: string;
  street2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface PanVerifyResponse {
  message: string;
  currentStep: number;
  fullName: string | null;
  category: string | null;
}

export interface StepResponse {
  message: string;
  currentStep: number;
}

export interface DecisionResponse {
  status: KycDecisionStatus;
  reason?: string;
  currentStep: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

// ============================================
// HTTP HELPER
// ============================================

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw {
      message: (data as { message?: string }).message || 'An error occurred',
      statusCode: res.status,
      errors: (data as { errors?: Record<string, string[]> }).errors,
    } as ApiError;
  }
  return data as T;
}

async function apiUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { ...getAuthHeader() }, // NOTE: no Content-Type — browser sets multipart boundary
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw {
      message: (data as { message?: string }).message || 'Upload failed',
      statusCode: res.status,
    } as ApiError;
  }
  return data as T;
}

// ============================================
// API FUNCTIONS
// ============================================

export function getKycStatus(): Promise<KycStatus> {
  return apiCall<KycStatus>('/onboarding/status');
}

export function getKycDetails(): Promise<KycDetails | null> {
  return apiCall<KycDetails | null>('/onboarding/details');
}

export function saveConsent(): Promise<StepResponse> {
  return apiCall<StepResponse>('/onboarding/consent', {
    method: 'POST',
    body: JSON.stringify({ consented: true }),
  });
}

export function verifyPan(data: PanVerifyData): Promise<PanVerifyResponse> {
  return apiCall<PanVerifyResponse>('/onboarding/pan/verify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function requestAadhaarOtp(aadhaarNumber: string): Promise<StepResponse> {
  return apiCall<StepResponse>('/onboarding/aadhaar/otp/request', {
    method: 'POST',
    body: JSON.stringify({ aadhaarNumber }),
  });
}

export function verifyAadhaarOtp(otp: string): Promise<StepResponse> {
  return apiCall<StepResponse>('/onboarding/aadhaar/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });
}

export function confirmAddress(data: AddressData): Promise<StepResponse> {
  return apiCall<StepResponse>('/onboarding/address', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function uploadSelfie(file: Blob, filename = 'selfie.jpg'): Promise<DecisionResponse> {
  const fd = new FormData();
  fd.append('selfie', file, filename);
  return apiUpload<DecisionResponse>('/onboarding/selfie', fd);
}

export function resetKyc(): Promise<StepResponse> {
  return apiCall<StepResponse>('/onboarding/reset', { method: 'POST' });
}
