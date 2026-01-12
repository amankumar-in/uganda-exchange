import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}



  /**
   * POST /orders
   * Place a new order
   */
  @Post()
  async placeOrder(
    @Request() req: any,
    @Body()
    body: {
      productId: string;
      side: 'BUY' | 'SELL';
      amount: number;
    },
  ) {
    try {
      const { productId, side, amount } = body;

      if (!productId || !side || !amount) {
        throw new HttpException(
          'productId, side, and amount are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!['BUY', 'SELL'].includes(side)) {
        throw new HttpException(
          'side must be BUY or SELL',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (amount <= 0) {
        throw new HttpException(
          'amount must be greater than 0',
          HttpStatus.BAD_REQUEST,
        );
      }

      const order = await this.ordersService.placeOrder({
        userId: req.user.id,
        productId,
        side,
        amount,
      });

      return { success: true, order };
    } catch (error: any) {
      // Log technical details for debugging
      this.logger.error('Order placement failed', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
      });

      // Determine appropriate status code based on error type
      let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      let userMessage = 'Unable to process trade at this time. Please try again later.';
      
      if (error instanceof BadRequestException) {
        statusCode = HttpStatus.BAD_REQUEST;
        // Use the message from BadRequestException if it's user-friendly
        userMessage = error.message;
      } else if (error.message?.includes('Insufficient balance') && !error.message?.includes('Coinbase')) {
        // Our ledger insufficient funds - show specific message
        statusCode = HttpStatus.BAD_REQUEST;
        userMessage = error.message; // This is already user-friendly from AssetsService
      } else if (error.message?.includes('Coinbase') || error.message?.includes('INSUFFICIENT_FUND')) {
        // Coinbase API errors - generic message
        statusCode = HttpStatus.BAD_GATEWAY;
        userMessage = 'Unable to process trade at this time. Please try again later.';
      }

      throw new HttpException(
        userMessage,
        statusCode,
      );
    }
  }

  /**
   * GET /orders
   * Get user's orders
   */
  @Get()
  async getOrders(
    @Request() req: any,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      const result = await this.ordersService.getUserOrders(req.user.id, {
        productId,
        status: status as any,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
      });

      return { success: true, ...result };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /orders/revenue
   * Get platform revenue (admin/system only)
   */
  @Get('revenue')
  async getRevenue(@Request() req: any) {
    try {
      // Check if user is admin (optional - you can remove this check if you want anyone to see revenue)
      // if (req.user.role !== 'ADMIN') {
      //   throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
      // }
      
      const revenue = await this.ordersService.getRevenue();
      return { success: true, revenue };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch revenue',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /orders/quote
   * Get quote for a trade (estimate)
   */
  @Get('quote')
  async getQuote(
    @Query('productId') productId: string,
    @Query('side') side: 'BUY' | 'SELL',
    @Query('amount') amount: string,
  ) {
    try {
      if (!productId || !side || !amount) {
        throw new HttpException(
          'productId, side, and amount are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!['BUY', 'SELL'].includes(side)) {
        throw new HttpException(
          'side must be BUY or SELL',
          HttpStatus.BAD_REQUEST,
        );
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new HttpException(
          'amount must be a positive number',
          HttpStatus.BAD_REQUEST,
        );
      }

      const quote = await this.ordersService.getQuote(productId, side, amountNum);
      return { success: true, quote };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to get quote',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /orders/:orderId
   * Get a single order
   */
  @Get(':orderId')
  async getOrder(@Request() req: any, @Param('orderId') orderId: string) {
    try {
      const order = await this.ordersService.getOrder(req.user.id, orderId);

      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      return { success: true, order };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to fetch order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

