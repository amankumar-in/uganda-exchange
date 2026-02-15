import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, basename } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService, UpdateUserDto, UpdateKycStatusDto, BalanceAdjustmentDto } from './admin.service';
import {
  DemoCollegeCoinsService,
  CreateDemoCollegeCoinDto,
  UpdateDemoCollegeCoinDto,
} from '../demo-college-coins/demo-college-coins.service';
import { KycRestrictionsService } from '../kyc/kyc-restrictions.service';
import {
  CreateCountryDto,
  UpdateCountryDto,
  AddStatesDto,
  UpdateStateDto,
  BulkToggleStatesDto,
  ToggleActiveDto,
} from '../kyc/dto/kyc-restrictions.dto';
import { UserRole, KycStatus, TransactionStatus, TradeStatus } from '@prisma/client';
import * as csv from 'csv-parse/sync';

// All uploads go to backend/uploads folder (attach persistent disk here on Render)
const uploadsBasePath = join(process.cwd(), 'uploads');

// Configure multer storage for college coin icons
// Upload path kept as 'college-coins' for backward compatibility with existing icon URLs in DB
const iconUploadPath = join(uploadsBasePath, 'college-coins');

// Ensure directory exists
if (!existsSync(iconUploadPath)) {
  mkdirSync(iconUploadPath, { recursive: true });
}

const iconStorage = diskStorage({
  destination: (req, file, cb) => {
    cb(null, iconUploadPath);
  },
  filename: (req, file, cb) => {
    // Generate filename: ticker-timestamp.ext
    const ticker = req.body.ticker || 'icon';
    const uniqueSuffix = Date.now();
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${ticker.toLowerCase()}-${uniqueSuffix}${ext}`);
  },
});

const imageFileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Invalid file type. Only PNG, JPEG, GIF, WebP, and SVG are allowed.'), false);
  }
};

// Configure multer storage for media manager (any file type)
const mediaUploadPath = join(uploadsBasePath, 'media');

// Ensure media directory exists
if (!existsSync(mediaUploadPath)) {
  mkdirSync(mediaUploadPath, { recursive: true });
}

const mediaStorage = diskStorage({
  destination: (req, file, cb) => {
    cb(null, mediaUploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: original-name-timestamp.ext
    const originalName = basename(file.originalname, extname(file.originalname));
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const uniqueSuffix = Date.now();
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
  },
});

// Export paths for use in file serving
export { uploadsBasePath, iconUploadPath, mediaUploadPath };

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly collegeCoinsService: DemoCollegeCoinsService,
    private readonly kycRestrictionsService: KycRestrictionsService,
  ) {}

  // ============================================
  // USER MANAGEMENT
  // ============================================

  /**
   * Get paginated list of users
   */
  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('kycStatus') kycStatus?: string,
  ) {
    const result = await this.adminService.getUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      role: role as UserRole | undefined,
      kycStatus: kycStatus as KycStatus | undefined,
    });

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Get single user details
   */
  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.adminService.getUserById(id);
    return {
      success: true,
      user,
    };
  }

  /**
   * Update user role
   */
  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: UserRole,
  ) {
    if (!role || !['USER', 'ADMIN'].includes(role)) {
      throw new BadRequestException('Invalid role. Must be USER or ADMIN.');
    }

    const user = await this.adminService.updateUserRole(id, role);
    return {
      success: true,
      user,
      message: `User role updated to ${role}`,
    };
  }

  /**
   * Update user fields (emailVerified, phoneVerified, appMode, role)
   */
  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Req() req: Request,
  ) {
    const adminId = (req as any).user?.id || 'unknown';
    const user = await this.adminService.updateUser(id, body, adminId);
    return {
      success: true,
      user,
      message: 'User updated successfully',
    };
  }

  /**
   * Get user balances (live + learner)
   */
  @Get('users/:id/balances')
  async getUserBalances(@Param('id') id: string) {
    const balances = await this.adminService.getUserBalances(id);
    return {
      success: true,
      balances,
    };
  }

  /**
   * Adjust user balance
   */
  @Post('users/:id/balance-adjustment')
  async adjustUserBalance(
    @Param('id') id: string,
    @Body() body: BalanceAdjustmentDto,
    @Req() req: Request,
  ) {
    if (!body.asset || body.amount === undefined || !body.mode) {
      throw new BadRequestException('Missing required fields: asset, amount, mode');
    }

    if (!['live', 'learner'].includes(body.mode)) {
      throw new BadRequestException('Mode must be "live" or "learner"');
    }

    const adminId = (req as any).user?.id || 'unknown';
    const result = await this.adminService.adjustBalance(id, body, adminId);
    return {
      ...result,
      success: true,
      message: `Balance adjusted: ${body.amount > 0 ? '+' : ''}${body.amount} ${body.asset}`,
    };
  }

  /**
   * Get user transactions (deposits/withdrawals)
   */
  @Get('users/:id/transactions')
  async getUserTransactions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.adminService.getUserTransactions(id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      type: type as 'DEPOSIT' | 'WITHDRAWAL' | undefined,
      status: status as TransactionStatus | undefined,
    });

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Update transaction status
   */
  @Patch('users/:id/transactions/:txId')
  async updateTransactionStatus(
    @Param('id') userId: string,
    @Param('txId') txId: string,
    @Body('status') status: TransactionStatus,
    @Req() req: Request,
  ) {
    if (!status || !['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    const adminId = (req as any).user?.id || 'unknown';
    const transaction = await this.adminService.updateTransactionStatus(userId, txId, status, adminId);
    return {
      success: true,
      transaction,
      message: `Transaction status updated to ${status}`,
    };
  }

  /**
   * Get user trades (live + learner)
   */
  @Get('users/:id/trades')
  async getUserTrades(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('mode') mode?: string,
    @Query('status') status?: string,
  ) {
    const result = await this.adminService.getUserTrades(id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      mode: mode as 'live' | 'learner' | 'all' | undefined,
      status: status as TradeStatus | undefined,
    });

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Update KYC status (approve/reject)
   */
  @Patch('users/:id/kyc')
  async updateKycStatus(
    @Param('id') id: string,
    @Body() body: { status: KycStatus; reviewNotes?: string },
    @Req() req: Request,
  ) {
    if (!body.status || !['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(body.status)) {
      throw new BadRequestException('Invalid KYC status');
    }

    const adminId = (req as any).user?.id || 'unknown';
    const result = await this.adminService.updateKycStatus(id, {
      status: body.status,
      reviewNotes: body.reviewNotes,
      reviewedBy: adminId,
    });

    return {
      ...result,
      success: true,
      message: `KYC status updated to ${body.status}`,
    };
  }

  /**
   * Reset learner account
   */
  @Post('users/:id/learner/reset')
  async resetLearnerAccount(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const adminId = (req as any).user?.id || 'unknown';
    const result = await this.adminService.resetLearnerAccount(id, adminId);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Delete user
   */
  @Delete('users/:id')
  async deleteUser(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const adminId = (req as any).user?.id || 'unknown';
    const result = await this.adminService.deleteUser(id, adminId);
    return {
      success: true,
      ...result,
    };
  }

  // ============================================
  // DEMO COLLEGE COINS MANAGEMENT
  // ============================================

  /**
   * Get list of reference tokens for pegging
   */
  @Get('demo-college-coins/reference-tokens')
  getReferenceTokens() {
    return {
      success: true,
      tokens: this.collegeCoinsService.getReferenceTokens(),
    };
  }

  /**
   * Get all demo college coins (including inactive)
   */
  @Get('demo-college-coins')
  async getCollegeCoins() {
    const coins = await this.collegeCoinsService.findAll(true);
    return {
      success: true,
      coins,
    };
  }

  /**
   * Get single demo college coin
   */
  @Get('demo-college-coins/:id')
  async getCollegeCoin(@Param('id') id: string) {
    const coin = await this.collegeCoinsService.findById(id);
    return {
      success: true,
      coin,
    };
  }

  /**
   * Create a new demo college coin
   */
  @Post('demo-college-coins')
  @UseInterceptors(
    FileInterceptor('icon', {
      storage: iconStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    }),
  )
  async createCollegeCoin(
    @Body() body: any,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    // Parse categories if it's a string
    let categories: string[] = [];
    if (body.categories) {
      if (typeof body.categories === 'string') {
        try {
          categories = JSON.parse(body.categories);
        } catch {
          categories = body.categories.split(',').map((c: string) => c.trim());
        }
      } else if (Array.isArray(body.categories)) {
        categories = body.categories;
      }
    }

    // Helper to convert empty strings and "null" to actual null/undefined
    const toNullable = (val: any): string | undefined => {
      if (val === undefined || val === null || val === '' || val === 'null') return undefined;
      return val;
    };

    // Parse genesis date safely
    let genesisDate: Date | undefined = undefined;
    const dateStr = toNullable(body.genesisDate);
    if (dateStr) {
      const parsed = new Date(dateStr);
      genesisDate = isNaN(parsed.getTime()) ? undefined : parsed;
    }

    const dto: CreateDemoCollegeCoinDto = {
      ticker: body.ticker,
      name: body.name,
      iconUrl: icon ? `/api/uploads/college-coins/${icon.filename}` : body.iconUrl,
      peggedToAsset: body.peggedToAsset,
      peggedPercentage: parseFloat(body.peggedPercentage),
      isActive: body.isActive === 'true' || body.isActive === true,
      description: toNullable(body.description),
      website: toNullable(body.website),
      whitepaper: toNullable(body.whitepaper),
      twitter: toNullable(body.twitter),
      discord: toNullable(body.discord),
      categories,
      genesisDate,
    };

    const coin = await this.collegeCoinsService.create(dto);
    return {
      success: true,
      coin,
      message: `Demo college coin ${coin.ticker} created successfully`,
    };
  }

  /**
   * Update a demo college coin
   */
  @Patch('demo-college-coins/:id')
  @UseInterceptors(
    FileInterceptor('icon', {
      storage: iconStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    }),
  )
  async updateCollegeCoin(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    // Parse categories if it's a string
    let categories: string[] | undefined;
    if (body.categories !== undefined) {
      if (typeof body.categories === 'string') {
        try {
          categories = JSON.parse(body.categories);
        } catch {
          categories = body.categories.split(',').map((c: string) => c.trim());
        }
      } else if (Array.isArray(body.categories)) {
        categories = body.categories;
      }
    }

    // Helper to convert empty strings and "null" to actual null
    const toNullable = (val: any): string | null => {
      if (val === undefined || val === null || val === '' || val === 'null') return null;
      return val;
    };

    // Parse genesis date safely
    let genesisDate: Date | null | undefined = undefined;
    if (body.genesisDate !== undefined) {
      const dateStr = toNullable(body.genesisDate);
      if (dateStr) {
        const parsed = new Date(dateStr);
        genesisDate = isNaN(parsed.getTime()) ? null : parsed;
      } else {
        genesisDate = null;
      }
    }

    const dto: UpdateDemoCollegeCoinDto = {
      ...(body.ticker && { ticker: body.ticker }),
      ...(body.name && { name: body.name }),
      ...(icon && { iconUrl: `/api/uploads/college-coins/${icon.filename}` }),
      ...(body.iconUrl && !icon && { iconUrl: body.iconUrl }),
      ...(body.peggedToAsset && { peggedToAsset: body.peggedToAsset }),
      ...(body.peggedPercentage !== undefined && {
        peggedPercentage: parseFloat(body.peggedPercentage),
      }),
      ...(body.isActive !== undefined && {
        isActive: body.isActive === 'true' || body.isActive === true,
      }),
      ...(body.description !== undefined && { description: toNullable(body.description) }),
      ...(body.website !== undefined && { website: toNullable(body.website) }),
      ...(body.whitepaper !== undefined && { whitepaper: toNullable(body.whitepaper) }),
      ...(body.twitter !== undefined && { twitter: toNullable(body.twitter) }),
      ...(body.discord !== undefined && { discord: toNullable(body.discord) }),
      ...(categories !== undefined && { categories }),
      ...(genesisDate !== undefined && { genesisDate }),
    };

    const coin = await this.collegeCoinsService.update(id, dto);
    return {
      success: true,
      coin,
      message: `Demo college coin ${coin.ticker} updated successfully`,
    };
  }

  /**
   * Delete a demo college coin
   */
  @Delete('demo-college-coins/:id')
  async deleteCollegeCoin(@Param('id') id: string) {
    await this.collegeCoinsService.delete(id);
    return {
      success: true,
      message: 'Demo college coin deleted successfully',
    };
  }

  /**
   * Import demo college coins from CSV
   * CSV columns: ticker,name,peggedToAsset,peggedPercentage,iconUrl,description,website,whitepaper,twitter,discord,categories,genesisDate,isActive
   */
  @Post('demo-college-coins/import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }),
  )
  async importCollegeCoins(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    if (!file.originalname.endsWith('.csv')) {
      throw new BadRequestException('File must be a CSV');
    }

    // Type for CSV record
    interface CsvRecord {
      ticker?: string;
      name?: string;
      peggedToAsset?: string;
      peggedPercentage?: string;
      iconUrl?: string;
      isActive?: string;
      description?: string;
      website?: string;
      whitepaper?: string;
      twitter?: string;
      discord?: string;
      categories?: string;
      genesisDate?: string;
    }

    try {
      const content = file.buffer.toString('utf-8');
      const records = csv.parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as CsvRecord[];

      const results = {
        total: records.length,
        created: 0,
        failed: 0,
        errors: [] as { row: number; ticker: string; error: string }[],
      };

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        try {
          // Parse categories
          let categories: string[] = [];
          if (record.categories) {
            categories = record.categories.split('|').map((c: string) => c.trim()).filter(Boolean);
          }

          const dto: CreateDemoCollegeCoinDto = {
            ticker: record.ticker?.toUpperCase() || '',
            name: record.name || '',
            peggedToAsset: record.peggedToAsset?.toUpperCase() || '',
            peggedPercentage: parseFloat(record.peggedPercentage || '0') || 0,
            iconUrl: record.iconUrl || undefined,
            isActive: record.isActive !== 'false' && record.isActive !== '0',
            description: record.description || undefined,
            website: record.website || undefined,
            whitepaper: record.whitepaper || undefined,
            twitter: record.twitter || undefined,
            discord: record.discord || undefined,
            categories,
            genesisDate: record.genesisDate ? new Date(record.genesisDate) : undefined,
          };

          // Validate required fields
          if (!dto.ticker || !dto.name || !dto.peggedToAsset || !dto.peggedPercentage) {
            throw new Error('Missing required fields: ticker, name, peggedToAsset, peggedPercentage');
          }

          await this.collegeCoinsService.create(dto);
          results.created++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: i + 2, // +2 because row 1 is header, and we're 0-indexed
            ticker: record.ticker || 'unknown',
            error: error.message || 'Unknown error',
          });
        }
      }

      return {
        success: true,
        message: `Imported ${results.created} of ${results.total} coins`,
        results,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to parse CSV: ${error.message}`);
    }
  }

  // ============================================
  // MEDIA MANAGER
  // ============================================

  /**
   * Upload multiple files to media manager
   */
  @Post('media/upload')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      storage: mediaStorage,
      // No file filter - accept any type
      // No size limit
    }),
  )
  async uploadMedia(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const uploaded = files.map((file) => {
      const stats = statSync(join(mediaUploadPath, file.filename));
      return {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: stats.size,
        url: `/api/uploads/media/${file.filename}`,
        uploadedAt: stats.birthtime,
      };
    });

    return {
      success: true,
      message: `${files.length} file(s) uploaded successfully`,
      files: uploaded,
    };
  }

  /**
   * List all files in media manager
   */
  @Get('media')
  async listMedia() {
    try {
      const files = readdirSync(mediaUploadPath);
      
      const mediaFiles = files
        .filter((filename) => !filename.startsWith('.')) // Exclude hidden files
        .map((filename) => {
          const filePath = join(mediaUploadPath, filename);
          const stats = statSync(filePath);
          const ext = extname(filename).toLowerCase();
          
          // Determine file type
          let type = 'file';
          const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];
          const videoExts = ['.mp4', '.webm', '.mov', '.avi'];
          const audioExts = ['.mp3', '.wav', '.ogg'];
          const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv'];
          
          if (imageExts.includes(ext)) type = 'image';
          else if (videoExts.includes(ext)) type = 'video';
          else if (audioExts.includes(ext)) type = 'audio';
          else if (docExts.includes(ext)) type = 'document';

          return {
            filename,
            type,
            size: stats.size,
            url: `/api/uploads/media/${filename}`,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first

      return {
        success: true,
        files: mediaFiles,
        total: mediaFiles.length,
      };
    } catch (error) {
      return {
        success: true,
        files: [],
        total: 0,
      };
    }
  }

  /**
   * Get single file details
   */
  @Get('media/:filename')
  async getMediaFile(@Param('filename') filename: string) {
    const filePath = join(mediaUploadPath, filename);
    
    if (!existsSync(filePath)) {
      throw new BadRequestException('File not found');
    }

    const stats = statSync(filePath);
    const ext = extname(filename).toLowerCase();
    
    // Determine file type
    let type = 'file';
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];
    const videoExts = ['.mp4', '.webm', '.mov', '.avi'];
    
    if (imageExts.includes(ext)) type = 'image';
    else if (videoExts.includes(ext)) type = 'video';

    return {
      success: true,
      file: {
        filename,
        type,
        size: stats.size,
        url: `/api/uploads/media/${filename}`,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      },
    };
  }

  /**
   * Delete a file from media manager
   */
  @Delete('media/:filename')
  async deleteMediaFile(@Param('filename') filename: string) {
    const filePath = join(mediaUploadPath, filename);

    if (!existsSync(filePath)) {
      throw new BadRequestException('File not found');
    }

    unlinkSync(filePath);

    return {
      success: true,
      message: 'File deleted successfully',
    };
  }

  // ============================================
  // KYC RESTRICTIONS MANAGEMENT
  // ============================================

  /**
   * Get all allowed countries with their states
   */
  @Get('kyc-restrictions/countries')
  async getAllowedCountries() {
    const countries = await this.kycRestrictionsService.getAllCountries();
    return {
      success: true,
      countries,
    };
  }

  /**
   * Create a new allowed country
   */
  @Post('kyc-restrictions/countries')
  async createAllowedCountry(@Body() dto: CreateCountryDto) {
    const country = await this.kycRestrictionsService.createCountry(dto);
    return {
      success: true,
      country,
      message: `Country ${dto.countryCode} added successfully`,
    };
  }

  /**
   * Get a specific country with its states
   */
  @Get('kyc-restrictions/countries/:countryCode')
  async getCountryWithStates(@Param('countryCode') countryCode: string) {
    const country = await this.kycRestrictionsService.getCountryByCode(countryCode);
    return {
      success: true,
      country,
    };
  }

  /**
   * Update an allowed country
   */
  @Patch('kyc-restrictions/countries/:countryCode')
  async updateAllowedCountry(
    @Param('countryCode') countryCode: string,
    @Body() dto: UpdateCountryDto,
  ) {
    const country = await this.kycRestrictionsService.updateCountry(countryCode, dto);
    return {
      success: true,
      country,
      message: `Country ${countryCode} updated successfully`,
    };
  }

  /**
   * Delete an allowed country (and all its states)
   */
  @Delete('kyc-restrictions/countries/:countryCode')
  async deleteAllowedCountry(@Param('countryCode') countryCode: string) {
    await this.kycRestrictionsService.deleteCountry(countryCode);
    return {
      success: true,
      message: `Country ${countryCode} deleted successfully`,
    };
  }

  /**
   * Toggle country active status
   */
  @Patch('kyc-restrictions/countries/:countryCode/toggle')
  async toggleCountry(
    @Param('countryCode') countryCode: string,
    @Body() dto: ToggleActiveDto,
  ) {
    const country = await this.kycRestrictionsService.toggleCountry(countryCode, dto.isActive);
    return {
      success: true,
      country,
      message: `Country ${countryCode} ${dto.isActive ? 'enabled' : 'disabled'}`,
    };
  }

  /**
   * Get states for a country
   */
  @Get('kyc-restrictions/countries/:countryCode/states')
  async getStatesForCountry(@Param('countryCode') countryCode: string) {
    const states = await this.kycRestrictionsService.getStatesForCountry(countryCode);
    return {
      success: true,
      states,
    };
  }

  /**
   * Add states to a country
   */
  @Post('kyc-restrictions/countries/:countryCode/states')
  async addStates(
    @Param('countryCode') countryCode: string,
    @Body() dto: AddStatesDto,
  ) {
    const states = await this.kycRestrictionsService.addStatesToCountry(countryCode, dto.states);
    return {
      success: true,
      states,
      message: `${states.length} state(s) added to ${countryCode}`,
    };
  }

  /**
   * Update a specific state
   */
  @Patch('kyc-restrictions/states/:stateId')
  async updateState(
    @Param('stateId') stateId: string,
    @Body() dto: UpdateStateDto,
  ) {
    const state = await this.kycRestrictionsService.updateState(stateId, dto);
    return {
      success: true,
      state,
      message: 'State updated successfully',
    };
  }

  /**
   * Delete a specific state
   */
  @Delete('kyc-restrictions/states/:stateId')
  async deleteState(@Param('stateId') stateId: string) {
    await this.kycRestrictionsService.deleteState(stateId);
    return {
      success: true,
      message: 'State deleted successfully',
    };
  }

  /**
   * Toggle state active status
   */
  @Patch('kyc-restrictions/states/:stateId/toggle')
  async toggleState(
    @Param('stateId') stateId: string,
    @Body() dto: ToggleActiveDto,
  ) {
    const state = await this.kycRestrictionsService.toggleState(stateId, dto.isActive);
    return {
      success: true,
      state,
      message: `State ${dto.isActive ? 'enabled' : 'disabled'}`,
    };
  }

  /**
   * Bulk toggle states for a country
   */
  @Post('kyc-restrictions/countries/:countryCode/states/bulk-toggle')
  async bulkToggleStates(
    @Param('countryCode') countryCode: string,
    @Body() dto: BulkToggleStatesDto,
  ) {
    await this.kycRestrictionsService.bulkToggleStates(countryCode, dto.stateCodes, dto.isActive);
    return {
      success: true,
      message: `${dto.stateCodes.length} state(s) ${dto.isActive ? 'enabled' : 'disabled'}`,
    };
  }

  /**
   * Get reference state list for a country (pre-populated data)
   */
  @Get('kyc-restrictions/reference-states/:countryCode')
  getReferenceStates(@Param('countryCode') countryCode: string) {
    const states = this.kycRestrictionsService.getReferenceStates(countryCode);
    return {
      success: true,
      states,
    };
  }
}

