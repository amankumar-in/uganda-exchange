import { IsString, Matches } from 'class-validator';

export class AadhaarRequestOtpDto {
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhaar must be 12 digits' })
  aadhaarNumber: string;
}
