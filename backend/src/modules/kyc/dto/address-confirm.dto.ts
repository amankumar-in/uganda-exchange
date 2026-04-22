import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class AddressConfirmDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  street1: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  street2?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  region: string;

  @IsString()
  @MinLength(4)
  @MaxLength(10)
  postalCode: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2)
  country: string; // ISO alpha-2 — "IN"
}
