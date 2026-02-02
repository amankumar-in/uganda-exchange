import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TuitTransferService } from './tuit-transfer.service';
import { TuitContractService } from './tuit-contract.service';

// ============================================
// DTOs
// ============================================

class InitiateTransferDto {
  @IsEmail()
  email: string;

  @IsString()
  walletAddress: string;
}

class VerifyTransferDto {
  @IsEmail()
  email: string;

  @IsString()
  walletAddress: string;

  @IsString()
  code: string;
}

class ConfirmTransferDto {
  @IsString()
  authorizedWalletId: string;

  @IsEmail()
  verificationEmail: string;
}

class SubmitConversionDto {
  @IsString()
  txHash: string;
}

class AddWalletDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  walletAddress: string;
}

class UpdateWalletDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class ReviewConversionDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

@Controller('tuit-transfer')
export class TuitTransferController {
  constructor(
    private readonly transferService: TuitTransferService,
    private readonly contractService: TuitContractService,
  ) {}

  // ============================================
  // PUBLIC / USER ENDPOINTS
  // ============================================

  /**
   * Get contract addresses for reference
   */
  @Get('contract-info')
  @UseGuards(JwtAuthGuard)
  getContractInfo() {
    return this.contractService.getContractAddresses();
  }

  // ============================================
  // FLOW 1: Transfer from Vesting Allocation
  // ============================================

  /**
   * Step 1: Initiate transfer - validates email/wallet and sends OTP
   */
  @Post('flow1/initiate')
  @UseGuards(JwtAuthGuard)
  async initiateTransfer(@Body() dto: InitiateTransferDto) {
    return this.transferService.initiateTransfer(dto.email, dto.walletAddress);
  }

  /**
   * Step 2: Verify OTP and get vesting data
   */
  @Post('flow1/verify')
  @UseGuards(JwtAuthGuard)
  async verifyAndGetVesting(@Body() dto: VerifyTransferDto) {
    return this.transferService.verifyAndGetVestingData(
      dto.email,
      dto.walletAddress,
      dto.code,
    );
  }

  /**
   * Step 3: Confirm and execute the transfer
   */
  @Post('flow1/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmTransfer(@Request() req, @Body() dto: ConfirmTransferDto) {
    return this.transferService.confirmTransfer(
      req.user.id,
      dto.authorizedWalletId,
      dto.verificationEmail,
    );
  }

  /**
   * Get user's transfer history (Flow 1)
   */
  @Get('flow1/history')
  @UseGuards(JwtAuthGuard)
  async getUserTransfers(@Request() req) {
    return this.transferService.getUserTransfers(req.user.id);
  }

  // ============================================
  // FLOW 2: Conversion of Withdrawn Tokens
  // ============================================

  /**
   * Submit a conversion request
   */
  @Post('flow2/submit')
  @UseGuards(JwtAuthGuard)
  async submitConversion(@Request() req, @Body() dto: SubmitConversionDto) {
    return this.transferService.submitConversionRequest(req.user.id, dto.txHash);
  }

  /**
   * Get user's conversion requests (Flow 2)
   */
  @Get('flow2/history')
  @UseGuards(JwtAuthGuard)
  async getUserConversions(@Request() req) {
    return this.transferService.getUserConversionRequests(req.user.id);
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  /**
   * Get transfer statistics
   */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Request() req) {
    this.requireAdmin(req);
    return this.transferService.getTransferStats();
  }

  /**
   * Import wallets from CSV
   */
  @Post('admin/import-csv')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@Request() req, @UploadedFile() file: Express.Multer.File) {
    this.requireAdmin(req);

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const csvContent = file.buffer.toString('utf-8');
    return this.transferService.importFromCsv(csvContent);
  }

  /**
   * Import wallets from CSV string (alternative for text input)
   */
  @Post('admin/import-csv-text')
  @UseGuards(JwtAuthGuard)
  async importCsvText(@Request() req, @Body() body: { csv: string }) {
    this.requireAdmin(req);

    if (!body.csv) {
      throw new BadRequestException('No CSV content provided');
    }

    return this.transferService.importFromCsv(body.csv);
  }

  /**
   * Get all authorized wallets
   */
  @Get('admin/wallets')
  @UseGuards(JwtAuthGuard)
  async getWallets(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    this.requireAdmin(req);
    return this.transferService.getAllAuthorizedWallets(
      parseInt(page || '1'),
      parseInt(limit || '50'),
      search,
    );
  }

  /**
   * Get vesting data for a wallet
   */
  @Get('admin/wallets/:id/vesting')
  @UseGuards(JwtAuthGuard)
  async getWalletVesting(@Request() req, @Param('id') id: string) {
    this.requireAdmin(req);
    return this.transferService.getWalletVestingData(id);
  }

  /**
   * Add a new authorized wallet
   */
  @Post('admin/wallets')
  @UseGuards(JwtAuthGuard)
  async addWallet(@Request() req, @Body() dto: AddWalletDto) {
    this.requireAdmin(req);
    return this.transferService.addAuthorizedWallet(
      dto.name,
      dto.email || null,
      dto.walletAddress,
    );
  }

  /**
   * Update an authorized wallet
   */
  @Put('admin/wallets/:id')
  @UseGuards(JwtAuthGuard)
  async updateWallet(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateWalletDto,
  ) {
    this.requireAdmin(req);
    await this.transferService.updateAuthorizedWallet(id, dto);
    return { success: true };
  }

  /**
   * Delete an authorized wallet
   */
  @Delete('admin/wallets/:id')
  @UseGuards(JwtAuthGuard)
  async deleteWallet(@Request() req, @Param('id') id: string) {
    this.requireAdmin(req);
    await this.transferService.deleteAuthorizedWallet(id);
    return { success: true };
  }

  /**
   * Get all conversion requests
   */
  @Get('admin/conversions')
  @UseGuards(JwtAuthGuard)
  async getConversions(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED',
  ) {
    this.requireAdmin(req);
    return this.transferService.getAllConversionRequests(
      parseInt(page || '1'),
      parseInt(limit || '50'),
      status,
    );
  }

  /**
   * Approve a conversion request
   */
  @Post('admin/conversions/:id/approve')
  @UseGuards(JwtAuthGuard)
  async approveConversion(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ReviewConversionDto,
  ) {
    this.requireAdmin(req);
    await this.transferService.approveConversionRequest(id, req.user.id, dto.notes);
    return { success: true };
  }

  /**
   * Reject a conversion request
   */
  @Post('admin/conversions/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectConversion(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ReviewConversionDto,
  ) {
    this.requireAdmin(req);
    if (!dto.notes) {
      throw new BadRequestException('Rejection reason is required');
    }
    await this.transferService.rejectConversionRequest(id, req.user.id, dto.notes);
    return { success: true };
  }

  // ============================================
  // HELPERS
  // ============================================

  private requireAdmin(req: any): void {
    if (req.user?.role !== 'ADMIN') {
      throw new BadRequestException('Admin access required');
    }
  }
}
