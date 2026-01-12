import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class PublicOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('book/:productId')
  async getOrderBook(@Param('productId') productId: string) {
    try {
      const book = await this.ordersService.getOrderBook(productId);
      return { success: true, book };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch order book',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
