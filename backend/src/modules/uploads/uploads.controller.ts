import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { existsSync, createReadStream, statSync } from 'fs';
import { lookup } from 'mime-types';

// Base uploads path (same as in admin.controller.ts)
const uploadsBasePath = join(process.cwd(), 'uploads');

@Controller('uploads')
export class UploadsController {
  /**
   * Serve college coin icons
   * GET /api/uploads/college-coins/:filename
   */
  // Upload path kept as 'college-coins' for backward compatibility with existing icon URLs in DB
  @Get('college-coins/:filename')
  async serveCollegeCoinIcon(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.serveFile('college-coins', filename, res);
  }

  /**
   * Serve media files
   * GET /api/uploads/media/:filename
   */
  @Get('media/:filename')
  async serveMediaFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.serveFile('media', filename, res);
  }

  /**
   * Serve KYC files (Aadhaar photos, selfies)
   * GET /api/uploads/kyc/:filename
   *
   * NOTE: Currently unauthenticated so <img> tags in the admin panel can
   * load these directly (browsers can't attach JWT headers to image
   * requests). This is PII — Aadhaar photo + user selfie. Before
   * production, switch to short-lived signed URLs or a cookie-based
   * session so these aren't world-readable to anyone with the URL.
   */
  @Get('kyc/:filename')
  async serveKycFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.serveFile('kyc', filename, res);
  }

  /**
   * Generic file serving helper
   */
  private serveFile(folder: string, filename: string, res: Response) {
    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(uploadsBasePath, folder, sanitizedFilename);

    // Check if file exists
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    // Get file stats
    const stat = statSync(filePath);

    // Determine content type
    const mimeType = lookup(filePath) || 'application/octet-stream';

    // Set headers
    res.set({
      'Content-Type': mimeType,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      'Access-Control-Allow-Origin': '*',
    });

    // Stream the file
    const fileStream = createReadStream(filePath);
    fileStream.pipe(res);
  }
}

