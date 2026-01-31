import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PriceCacheService, PriceCache } from './price-cache.service';
import { getWebSocketCorsOrigins } from '../../cors.utils';

@WebSocketGateway({
  cors: {
    origin: getWebSocketCorsOrigins(),
    credentials: true,
  },
  namespace: '/prices',
})
export class CoinbaseGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CoinbaseGateway.name);

  @WebSocketServer()
  server: Server;

  private connectedClients = 0;

  constructor(private readonly priceCacheService: PriceCacheService) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');

    // Subscribe to price updates from cache service
    this.priceCacheService.addListener((prices: PriceCache) => {
      this.broadcastPrices(prices);
    });
  }

  handleConnection(client: Socket) {
    this.connectedClients++;
    this.logger.log(`Client connected: ${client.id} (total: ${this.connectedClients})`);

    // Send current prices immediately on connect
    const currentPrices = this.priceCacheService.getCache();
    client.emit('prices', currentPrices);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.log(`Client disconnected: ${client.id} (total: ${this.connectedClients})`);
  }

  /**
   * Client can subscribe to specific pairs
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pairs: string[] },
  ) {
    this.logger.debug(`Client ${client.id} subscribing to: ${data.pairs?.join(', ')}`);
    
    // Join rooms for each pair
    if (data.pairs && Array.isArray(data.pairs)) {
      data.pairs.forEach((pair) => {
        client.join(`pair:${pair}`);
      });
    }

    // Send current prices for subscribed pairs
    const currentPrices = this.priceCacheService.getCache();
    const filteredPrices: PriceCache = {};
    
    if (data.pairs) {
      data.pairs.forEach((pair) => {
        if (currentPrices[pair]) {
          filteredPrices[pair] = currentPrices[pair];
        }
      });
    }

    client.emit('prices', filteredPrices);
    return { success: true, subscribed: data.pairs };
  }

  /**
   * Client can request current price for a specific pair
   */
  @SubscribeMessage('getPrice')
  handleGetPrice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { productId: string },
  ) {
    const price = this.priceCacheService.getPrice(data.productId);
    return { success: !!price, price };
  }

  /**
   * Broadcast prices to all connected clients
   */
  private broadcastPrices(prices: PriceCache) {
    if (this.connectedClients > 0) {
      this.server.emit('prices', prices);
    }
  }
}

