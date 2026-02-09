
export interface Token {
  id: string;
  symbol: string;
  name: string;
  iconUrl?: string;

  // Price Discovery Identity
  coingeckoId?: string;
  contractAddress?: string;
  chain?: string;
  
  // Manual Price Fallback
  manualPrice: number;
  currentPrice?: number; // Calculated/Fetched from backend
  change24h?: number; // Calculated/Fetched from backend

  // Toggles
  allowBuy: boolean;
  allowSell: boolean;
  allowTradeUsdt: boolean;
  allowTradeUsd: boolean;
  allowTradeEth: boolean;
  allowTradeTuit: boolean;
  allowDeposit: boolean;
  allowWithdraw: boolean;
  allowP2P: boolean;

  // Limits
  minTransactionAmount: number;
  maxTransactionAmount: number;

  // Mining & College Coin
  isCollegeCoin: boolean;
  miningAllowed: boolean;
  miningBaseRate: number;
  miningSessionHours: number;
  collegeName?: string;
  collegeCountry?: string;
  collegeLogo?: string;
  collegeCfcId?: string;

  // Metadata
  isActive: boolean;
  description?: string;
  website?: string;
  whitepaper?: string;
  twitter?: string;
  discord?: string;

  createdAt: string;
  updatedAt: string;
}

export interface GlobalAssetSettings {
  id: string;
  defaultAllowBuy: boolean;
  defaultAllowSell: boolean;
  defaultAllowP2P: boolean;
  defaultAllowDeposit: boolean;
  defaultAllowWithdraw: boolean;
  defaultAllowTradeUsd: boolean;
  defaultAllowTradeUsdt: boolean;
  defaultAllowTradeEth: boolean;
  defaultAllowTradeTuit: boolean;
  defaultMinTransaction: number;
  defaultMaxTransaction: number;
  defaultMiningBaseRate: number;
  defaultMiningSessionHours: number;
  updatedAt: string;
  createdAt: string;
}

export interface CreateTokenDto extends Omit<Token, 'id' | 'createdAt' | 'updatedAt' | 'currentPrice'> {}
export interface UpdateTokenDto extends Partial<CreateTokenDto> {}
