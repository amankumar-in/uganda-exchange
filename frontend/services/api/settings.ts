/**
 * Settings API Service
 * Handles user settings, password change, and notification preferences
 */

import { getApiBaseUrl } from './config';
const API_BASE_URL = getApiBaseUrl();

// Types
export interface KycDetails {
  pan: string | null;
  panName: string | null;
  aadhaarLast4: string | null;
  aadhaarName: string | null;
  aadhaarDob: string | null;
  aadhaarGender: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  panAadhaarLinked: boolean | null;
  currentStep: number;
}

export type AppMode = 'LEARNER' | 'INVESTOR';

export interface UserSettings {
  id: string;
  email: string;
  phone: string;
  phoneCountry: string;
  country: string;
  kycStatus: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  appMode: AppMode;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  kyc: KycDetails | null;
  notificationPreferences: NotificationPreferences | null;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  // Email Notifications
  emailMarketing: boolean;
  emailSecurityAlerts: boolean;
  emailTransactions: boolean;
  emailPriceAlerts: boolean;
  emailNewsUpdates: boolean;
  // Push Notifications
  pushEnabled: boolean;
  pushSecurityAlerts: boolean;
  pushTransactions: boolean;
  pushPriceAlerts: boolean;
  pushNewsUpdates: boolean;
  // SMS Notifications
  smsEnabled: boolean;
  smsSecurityAlerts: boolean;
  smsTransactions: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateNotificationPreferencesDto {
  emailMarketing?: boolean;
  emailSecurityAlerts?: boolean;
  emailTransactions?: boolean;
  emailPriceAlerts?: boolean;
  emailNewsUpdates?: boolean;
  pushEnabled?: boolean;
  pushSecurityAlerts?: boolean;
  pushTransactions?: boolean;
  pushPriceAlerts?: boolean;
  pushNewsUpdates?: boolean;
  smsEnabled?: boolean;
  smsSecurityAlerts?: boolean;
  smsTransactions?: boolean;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// Helper function for API calls
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
      throw { message: data.message || `API request failed: ${response.status}`, statusCode: response.status };
    }

    return data;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw { message: 'Backend server is not running. Please start the backend.', statusCode: 0 };
    }
    throw error;
  }
}

/**
 * Get user settings including profile, KYC, and notification preferences
 */
export async function getUserSettings(): Promise<UserSettings> {
  return apiCall<UserSettings>('/settings', {
    method: 'GET',
  });
}

/**
 * Request password change - sends OTP to email
 */
export async function requestPasswordChange(): Promise<{ message: string }> {
  return apiCall<{ message: string }>('/settings/password/request', {
    method: 'POST',
  });
}

/**
 * Change password with OTP verification
 */
export async function changePassword(otp: string, newPassword: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>('/settings/password/change', {
    method: 'POST',
    body: JSON.stringify({ otp, newPassword }),
  });
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiCall<NotificationPreferences>('/settings/notifications', {
    method: 'GET',
  });
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  preferences: UpdateNotificationPreferencesDto,
): Promise<NotificationPreferences> {
  return apiCall<NotificationPreferences>('/settings/notifications', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
}

/**
 * Update app mode (LEARNER or INVESTOR)
 */
export async function updateAppMode(
  mode: AppMode,
): Promise<{ appMode: AppMode; message: string }> {
  return apiCall<{ appMode: AppMode; message: string }>('/settings/app-mode', {
    method: 'PUT',
    body: JSON.stringify({ mode }),
  });
}

