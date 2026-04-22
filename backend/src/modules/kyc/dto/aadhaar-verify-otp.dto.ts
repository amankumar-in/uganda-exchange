import { IsString, Matches } from 'class-validator';

export class AadhaarVerifyOtpDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;
}
