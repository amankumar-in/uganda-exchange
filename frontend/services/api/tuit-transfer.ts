const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const headers: HeadersInit = {
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
}

// Types
export interface VestingData {
  walletAddress: string;
  totalAllocated: string;
  unlocked: string;
  withdrawn: string;
  availableToWithdraw: string;
}

export interface AuthorizedWallet {
  id: string;
  name: string;
  email: string | null;
  walletAddress: string;
  isActive: boolean;
  isTestPair: boolean;
  testTotalAllocated: string | null;
  testUnlocked: string | null;
  testWithdrawn: string | null;
  hasTransferred: boolean;
  transfer?: {
    id: string;
    userId: string;
    amountCredited: string;
    createdAt: string;
  };
}

export interface ConversionRequest {
  id: string;
  userId: string;
  userEmail: string;
  txHash: string;
  amount: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface TransferStats {
  totalWallets: number;
  activeWallets: number;
  completedTransfers: number;
  pendingConversions: number;
  approvedConversions: number;
  totalCredited: string;
  totalConverted: string;
}

export interface UserTransfer {
  id: string;
  name: string;
  walletAddress: string;
  verificationEmail: string;
  totalAllocated: string;
  totalUnlocked: string;
  totalWithdrawn: string;
  amountCredited: string;
  status: string;
  createdAt: string;
}

export interface UserConversionRequest {
  id: string;
  txHash: string;
  amount: string | null;
  status: string;
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface ContractInfo {
  vestingContract: string;
  tuitToken: string;
  depositWallet: string;
}

// ============================================
// USER API
// ============================================

export const TuitTransferApi = {
  // Get contract addresses
  getContractInfo: async (): Promise<ContractInfo> => {
    return apiCall('/tuit-transfer/contract-info');
  },

  // Flow 1: Initiate transfer
  initiateTransfer: async (email: string, walletAddress: string): Promise<{ success: boolean; name: string }> => {
    return apiCall('/tuit-transfer/flow1/initiate', {
      method: 'POST',
      body: JSON.stringify({ email, walletAddress }),
    });
  },

  // Flow 1: Verify OTP and get vesting data
  verifyAndGetVesting: async (
    email: string,
    walletAddress: string,
    code: string,
  ): Promise<{ vestingData: VestingData; name: string; authorizedWalletId: string }> => {
    return apiCall('/tuit-transfer/flow1/verify', {
      method: 'POST',
      body: JSON.stringify({ email, walletAddress, code }),
    });
  },

  // Flow 1: Confirm transfer
  confirmTransfer: async (
    authorizedWalletId: string,
    verificationEmail: string,
  ): Promise<{ success: boolean; amountCredited: string }> => {
    return apiCall('/tuit-transfer/flow1/confirm', {
      method: 'POST',
      body: JSON.stringify({ authorizedWalletId, verificationEmail }),
    });
  },

  // Flow 1: Get user's transfer history
  getUserTransfers: async (): Promise<UserTransfer[]> => {
    return apiCall('/tuit-transfer/flow1/history');
  },

  // Flow 2: Submit conversion request
  submitConversion: async (txHash: string): Promise<{ success: boolean; requestId: string }> => {
    return apiCall('/tuit-transfer/flow2/submit', {
      method: 'POST',
      body: JSON.stringify({ txHash }),
    });
  },

  // Flow 2: Get user's conversion requests
  getUserConversions: async (): Promise<UserConversionRequest[]> => {
    return apiCall('/tuit-transfer/flow2/history');
  },
};

// ============================================
// ADMIN API
// ============================================

export const TuitTransferAdminApi = {
  // Get statistics
  getStats: async (): Promise<TransferStats> => {
    return apiCall('/tuit-transfer/admin/stats');
  },

  // Import wallets from CSV file
  importCsv: async (file: File): Promise<{ imported: number; skipped: number; errors: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiCall('/tuit-transfer/admin/import-csv', {
      method: 'POST',
      body: formData,
    });
  },

  // Import wallets from CSV text
  importCsvText: async (csv: string): Promise<{ imported: number; skipped: number; errors: string[] }> => {
    return apiCall('/tuit-transfer/admin/import-csv-text', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    });
  },

  // Get all authorized wallets
  getWallets: async (
    page: number = 1,
    limit: number = 50,
    search?: string,
  ): Promise<{ wallets: AuthorizedWallet[]; total: number; page: number; totalPages: number }> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
    });
    return apiCall(`/tuit-transfer/admin/wallets?${params}`);
  },

  // Get vesting data for a wallet
  getWalletVesting: async (walletId: string): Promise<VestingData> => {
    return apiCall(`/tuit-transfer/admin/wallets/${walletId}/vesting`);
  },

  // Add authorized wallet
  addWallet: async (
    name: string,
    walletAddress: string,
    email?: string,
    isTestPair?: boolean,
    testVestingData?: {
      testTotalAllocated?: string;
      testUnlocked?: string;
      testWithdrawn?: string;
    },
  ): Promise<{ id: string }> => {
    return apiCall('/tuit-transfer/admin/wallets', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        walletAddress,
        isTestPair,
        ...(isTestPair && testVestingData),
      }),
    });
  },

  // Update authorized wallet
  updateWallet: async (
    id: string,
    data: {
      name?: string;
      email?: string;
      isActive?: boolean;
      isTestPair?: boolean;
      testTotalAllocated?: string | null;
      testUnlocked?: string | null;
      testWithdrawn?: string | null;
    },
  ): Promise<{ success: boolean }> => {
    return apiCall(`/tuit-transfer/admin/wallets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete authorized wallet
  deleteWallet: async (id: string): Promise<{ success: boolean }> => {
    return apiCall(`/tuit-transfer/admin/wallets/${id}`, {
      method: 'DELETE',
    });
  },

  // Get all conversion requests
  getConversions: async (
    page: number = 1,
    limit: number = 50,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED',
  ): Promise<{ requests: ConversionRequest[]; total: number; page: number; totalPages: number }> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
    });
    return apiCall(`/tuit-transfer/admin/conversions?${params}`);
  },

  // Approve conversion request
  approveConversion: async (id: string, notes?: string): Promise<{ success: boolean }> => {
    return apiCall(`/tuit-transfer/admin/conversions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  // Reject conversion request
  rejectConversion: async (id: string, notes: string): Promise<{ success: boolean }> => {
    return apiCall(`/tuit-transfer/admin/conversions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },
};
