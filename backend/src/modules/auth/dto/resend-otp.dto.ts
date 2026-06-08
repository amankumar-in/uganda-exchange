import { IsEmail, IsString, IsOptional, Length } from 'class-validator';

export class ResendOtpDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(7, 15)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 4)
  phoneCountry?: string;

  @IsString()
  type: string; // REGISTER, LOGIN, RESET, etc.
}
