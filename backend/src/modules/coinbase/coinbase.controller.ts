import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoinbaseService } from './coinbase.service';
import { TokensService } from '../tokens/tokens.service';

@Controller('coinbase')
export class CoinbaseController {
  constructor(
    private readonly coinbaseService: CoinbaseService,
    private readonly tokensService: TokensService,
  ) {}

  /**
   * GET /coinbase/products
   * Get all available trading products
   */
  @Get('products')
  async getProducts(@Query('quote') quoteCurrency?: string) {
    try {
      const products = await this.coinbaseService.getProducts(quoteCurrency);
      // Auto-sync any new Coinbase tokens into the Token table
      await this.tokensService.syncCoinbaseTokens(products);
      return { success: true, products };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch products',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coinbase/products/:productId
   * Get single product details
   */
  @Get('products/:productId')
  async getProduct(@Param('productId') productId: string) {
    try {
      const product = await this.coinbaseService.getProduct(productId);
      return { success: true, product };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch product',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coinbase/candles/:productId
   * Get candle data for charts
   */
  @Get('candles/:productId')
  async getCandles(
    @Param('productId') productId: string,
    @Query('granularity') granularity?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    try {
      const validGranularities = [
        'ONE_MINUTE',
        'FIVE_MINUTE',
        'FIFTEEN_MINUTE',
        'ONE_HOUR',
        'SIX_HOUR',
        'ONE_DAY',
      ];

      const gran = validGranularities.includes(granularity || '')
        ? (granularity as any)
        : 'ONE_HOUR';

      const candles = await this.coinbaseService.getCandles(
        productId,
        gran,
        start ? parseInt(start) : undefined,
        end ? parseInt(end) : undefined,
      );

      return { success: true, candles };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch candles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coinbase/accounts
   * Get account balances (protected)
   */
  @UseGuards(JwtAuthGuard)
  @Get('accounts')
  async getAccounts() {
    try {
      const accounts = await this.coinbaseService.getAccounts();
      return { success: true, accounts };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch accounts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /coinbase/orders
   * Place a market order (protected)
   */
  @UseGuards(JwtAuthGuard)
  @Post('orders')
  async placeOrder(
    @Body()
    body: {
      productId: string;
      side: 'BUY' | 'SELL';
      quoteSize?: string;
      baseSize?: string;
    },
  ) {
    try {
      const { productId, side, quoteSize, baseSize } = body;

      if (!productId || !side) {
        throw new HttpException(
          'productId and side are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (side === 'BUY' && !quoteSize) {
        throw new HttpException(
          'quoteSize is required for BUY orders',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (side === 'SELL' && !baseSize) {
        throw new HttpException(
          'baseSize is required for SELL orders',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.coinbaseService.placeMarketOrder(
        productId,
        side,
        quoteSize,
        baseSize,
      );

      return { success: result.success, orderId: result.orderId };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to place order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coinbase/orders
   * Get order history (protected)
   */
  @UseGuards(JwtAuthGuard)
  @Get('orders')
  async getOrders(
    @Query('productId') productId?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const orders = await this.coinbaseService.getOrders(
        productId,
        limit ? parseInt(limit) : 50,
      );
      return { success: true, orders };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coinbase/orders/:orderId
   * Get single order details (protected)
   */
  @UseGuards(JwtAuthGuard)
  @Get('orders/:orderId')
  async getOrder(@Param('orderId') orderId: string) {
    try {
      const order = await this.coinbaseService.getOrder(orderId);
      return { success: true, order };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch order',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coinbase/orderbook/:productId
   * Get order book with bids and asks
   */
  @Get('orderbook/:productId')
  async getOrderBook(
    @Param('productId') productId: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const orderBook = await this.coinbaseService.getProductBook(
        productId,
        limit ? parseInt(limit) : 25,
      );
      return { success: true, orderBook };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch order book',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coinbase/trades/:productId
   * Get recent public trades
   */
  @Get('trades/:productId')
  async getPublicTrades(
    @Param('productId') productId: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const trades = await this.coinbaseService.getPublicTrades(
        productId,
        limit ? parseInt(limit) : 50,
      );
      return { success: true, trades };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch trades',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

