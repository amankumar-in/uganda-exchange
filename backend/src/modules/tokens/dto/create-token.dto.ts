
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateTokenDto {
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  // Price Discovery Identity
  @IsString()
  @IsOptional()
  coingeckoId?: string;

  @IsString()
  @IsOptional()
  contractAddress?: string;

  @IsString()
  @IsOptional()
  chain?: string;

  // Manual Price
  @IsNumber()
  @IsOptional()
  @Min(0)
  manualPrice?: number;

  // Toggles
  @IsBoolean()
  @IsOptional()
  allowBuy?: boolean;

  @IsBoolean()
  @IsOptional()
  allowSell?: boolean;

  @IsBoolean()
  @IsOptional()
  allowTradeUsdt?: boolean;

  @IsBoolean()
  @IsOptional()
  allowTradeUsd?: boolean;

  @IsBoolean()
  @IsOptional()
  allowTradeEth?: boolean;

  @IsBoolean()
  @IsOptional()
  allowTradeTuit?: boolean;

  @IsBoolean()
  @IsOptional()
  allowDeposit?: boolean;

  @IsBoolean()
  @IsOptional()
  allowWithdraw?: boolean;

  @IsBoolean()
  @IsOptional()
  allowP2P?: boolean;

  // Limits
  @IsNumber()
  @IsOptional()
  @Min(0)
  minTransactionAmount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  maxTransactionAmount?: number;

  // Metadata
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  whitepaper?: string;

  @IsString()
  @IsOptional()
  twitter?: string;

  @IsString()
  @IsOptional()
  discord?: string;

  // Token Type
  @IsBoolean()
  @IsOptional()
  isNative?: boolean;

  // Mining & College Coin
  @IsBoolean()
  @IsOptional()
  isCollegeCoin?: boolean;

  @IsBoolean()
  @IsOptional()
  miningAllowed?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  miningBaseRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  miningSessionHours?: number;

  @IsString()
  @IsOptional()
  collegeName?: string;

  @IsString()
  @IsOptional()
  collegeCountry?: string;

  @IsString()
  @IsOptional()
  collegeLogo?: string;

  @IsString()
  @IsOptional()
  collegeCfcId?: string;
}
