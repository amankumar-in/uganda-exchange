import { IsString, MinLength, Matches, IsOptional } from 'class-validator';

export class RequestPasswordChangeDto {
  // Empty - just triggers OTP send
}

export class ChangePasswordDto {
  @IsString()
  otp: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])/, {
    message: 'Password must include uppercase, lowercase, number, and special character',
  })
  newPassword: string;
}

