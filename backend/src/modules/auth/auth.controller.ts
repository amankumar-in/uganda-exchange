import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetRequestDto, ResetVerifyDto, ResetNewPasswordDto } from './dto/password-reset.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    private otpService: OtpService,
  ) {}

  @Post('account/create')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('account/login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('otp/resend/email')
  async resendEmailOtp(@Body() dto: ResendOtpDto) {
    if (!dto.email) {
      throw new Error('Email is required');
    }
    
    await this.otpService.sendEmailOtp(dto.email, dto.type);
    
    return {
      message: 'Verification code sent to your email',
    };
  }

  @Post('otp/resend/phone')
  async resendPhoneOtp(@Body() dto: ResendOtpDto) {
    if (!dto.phone || !dto.phoneCountry) {
      throw new Error('Phone and phoneCountry are required');
    }
    
    await this.otpService.sendPhoneOtp(dto.phoneCountry, dto.phone, dto.type);
    
    return {
      message: 'Verification code sent to your phone',
    };
  }

  @Post('account/reset')
  async resetRequest(@Body() dto: ResetRequestDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('account/reset/verify')
  async resetVerify(@Body() dto: ResetVerifyDto) {
    return this.authService.verifyResetOtp(dto.otp, dto.token);
  }

  @Post('account/reset/new-password')
  async resetNewPassword(@Body() dto: ResetNewPasswordDto) {
    return this.authService.setNewPassword(dto.password, dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('account/me')
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('account/logout')
  async logout() {
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('account/learner-welcome/seen')
  async markLearnerWelcomeSeen(@Request() req) {
    return this.authService.markLearnerWelcomeSeen(req.user.id);
  }
}
