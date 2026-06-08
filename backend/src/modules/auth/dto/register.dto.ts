import { IsEmail, IsString, MinLength, Matches, IsOptional, Length } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(7, 15)
  phone: string;

  @IsString()
  @Length(1, 4)
  phoneCountry: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^\&\*])(?=.{8,})/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;

  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  otpEmail?: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  otpPhone?: string;
}
