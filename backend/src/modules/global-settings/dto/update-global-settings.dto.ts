import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateGlobalSettingsDto {
  @IsBoolean()
  @IsOptional()
  defaultAllowBuy?: boolean;

  @IsBoolean()
  @IsOptional()
  defaultAllowSell?: boolean;

  @IsBoolean()
  @IsOptional()
  defaultAllowP2P?: boolean;

  @IsBoolean()
  @IsOptional()
  defaultAllowDeposit?: boolean;

  @IsBoolean()
  @IsOptional()
  defaultAllowWithdraw?: boolean;

  @IsBoolean()
  @IsOptional()
  defaultAllowTradeInr?: boolean;

  @IsBoolean()
  @IsOptional()
  defaultAllowTradeUsdt?: boolean;

  @IsBoolean()
  @IsOptional()
  defaultAllowTradeEth?: boolean;

  @IsBoolean()
  @IsOptional()
  defaultAllowTradeTuit?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  defaultMinTransaction?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  defaultMaxTransaction?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  defaultMiningBaseRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  defaultMiningSessionHours?: number;

  @IsBoolean()
  @IsOptional()
  applyToExisting?: boolean;
}
