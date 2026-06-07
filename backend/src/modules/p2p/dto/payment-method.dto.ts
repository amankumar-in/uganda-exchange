import {
  IsString,
  IsEnum,
  IsObject,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';

export enum PaymentMethodType {
  BANK_TRANSFER = 'BANK_TRANSFER',
  MOBILE_MONEY = 'MOBILE_MONEY',
  PAYPAL = 'PAYPAL',
  VENMO = 'VENMO',
  ZELLE = 'ZELLE',
  CASH_APP = 'CASH_APP',
  WISE = 'WISE',
  REVOLUT = 'REVOLUT',
  OTHER = 'OTHER',
}

export class CreatePaymentMethodDto {
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsObject()
  details: Record<string, string>; // e.g., { accountNumber: "****1234", bankName: "Chase" }
}

export class UpdatePaymentMethodDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsObject()
  @IsOptional()
  details?: Record<string, string>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

