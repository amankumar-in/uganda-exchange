/**
 * Authentication API Service
 * Handles all auth-related API calls
 */

import { getApiBaseUrl } from './config';
const API_BASE_URL = getApiBaseUrl();

// Types
export interface RegisterData {
  email: string;
  phone: string;
  phoneCountry: string;
  password: string;
  country: string;
}

export interface RegisterVerifyData extends RegisterData {
  otpEmail: string;
  otpPhone?: string; // Phone OTP temporarily disabled
}

export interface LoginData {
  email: string;
  password: string;
  remember?: boolean;
}

export type AppMode = 'LEARNER' | 'INVESTOR';
export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  phone: string;
  phoneCountry: string;
  country: string;
  kycStatus: string;
  appMode: AppMode;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface ResetRequestData {
  email: string;
}

export interface ResetRequestResponse {
  message: string;
  nextStep: string;
  token: string;
}

export interface ResetVerifyData {
  otp: string;
  token: string;
}

export interface ResetNewPasswordData {
  password: string;
  token: string;
}

export interface ResendOtpData {
  email?: string;
  phone?: string;
  phoneCountry?: string;
  type: 'REGISTER' | 'RESET' | 'UPDATE_EMAIL' | 'UPDATE_PHONE';
}

export interface ApiResponse<T = unknown> {
  message: string;
  data?: T;
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

// Auth API Functions

/**
 * Register a new user - Step 1: Send OTP
 */
export async function registerUser(data: RegisterData): Promise<ApiResponse> {
  return apiCall<ApiResponse>('/account/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Register a new user - Step 2: Verify OTP and create account
 */
export async function verifyRegistration(data: RegisterVerifyData): Promise<ApiResponse> {
  return apiCall<ApiResponse>('/account/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Login user
 */
export async function loginUser(data: LoginData): Promise<LoginResponse> {
  const response = await apiCall<LoginResponse>('/account/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  // Store token on successful login (both localStorage and cookie for middleware)
  if (response.token && typeof window !== 'undefined') {
    localStorage.setItem('authToken', response.token);
    // Set cookie for middleware (httpOnly=false so JS can clear it, but middleware can read it)
    document.cookie = `authToken=${response.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
  }

  return response;
}

/**
 * Logout user
 */
export async function logoutUser(): Promise<ApiResponse> {
  // Always clear token first, before API call (both localStorage and cookie)
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
    // Clear cookie by setting expired date
    document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }

  try {
    const response = await apiCall<ApiResponse>('/account/logout', {
      method: 'POST',
    });
    return response;
  } catch {
    // Token already cleared, return success regardless
    return { message: 'Logged out successfully' };
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<User> {
  return apiCall<User>('/account/me', {
    method: 'GET',
  });
}

/**
 * Request password reset - sends OTP to email
 */
export async function requestPasswordReset(data: ResetRequestData): Promise<ResetRequestResponse> {
  return apiCall<ResetRequestResponse>('/account/reset', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Verify password reset OTP
 */
export async function verifyPasswordResetOtp(data: ResetVerifyData): Promise<ApiResponse> {
  return apiCall<ApiResponse>('/account/reset/verify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Set new password after OTP verification
 */
export async function setNewPassword(data: ResetNewPasswordData): Promise<ApiResponse> {
  return apiCall<ApiResponse>('/account/reset/new-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Resend email OTP
 */
export async function resendEmailOtp(
  email: string,
  type: ResendOtpData['type']
): Promise<ApiResponse> {
  return apiCall<ApiResponse>('/otp/resend/email', {
    method: 'POST',
    body: JSON.stringify({ email, type }),
  });
}

/**
 * Resend phone OTP
 */
export async function resendPhoneOtp(
  phone: string,
  phoneCountry: string,
  type: ResendOtpData['type']
): Promise<ApiResponse> {
  return apiCall<ApiResponse>('/otp/resend/phone', {
    method: 'POST',
    body: JSON.stringify({ phone, phoneCountry, type }),
  });
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('authToken');
}

/**
 * Get stored auth token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

