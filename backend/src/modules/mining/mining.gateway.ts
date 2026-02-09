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
import { getWebSocketCorsOrigins } from '../../cors.utils';
import { MiningService } from './mining.service';

@WebSocketGateway({
  cors: {
    origin: getWebSocketCorsOrigins(),
    credentials: true,
  },
  namespace: '/mining',
})
export class MiningGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MiningGateway.name);

  @WebSocketServer()
  server: Server;

  private connectedClients = 0;

  constructor(private readonly miningService: MiningService) {}

  afterInit() {
    this.logger.log('Mining WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.connectedClients++;
    this.logger.log(
      `Mining client connected: ${client.id} (total: ${this.connectedClients})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.log(
      `Mining client disconnected: ${client.id} (total: ${this.connectedClients})`,
    );
  }

  // Client subscribes to mining updates for a user
  @SubscribeMessage('subscribe_mining')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (data.userId) {
      client.join(`mining:${data.userId}`);
      this.logger.debug(
        `Client ${client.id} subscribed to mining updates for user ${data.userId}`,
      );
    }
    return { success: true };
  }

  // Broadcast mining status update to a specific user
  broadcastMiningUpdate(userId: string, data: any) {
    this.server.to(`mining:${userId}`).emit('mining_update', data);
  }

  // Broadcast session completion
  broadcastSessionCompleted(
    userId: string,
    data: { tokenId: string; symbol: string; tokensEarned: number },
  ) {
    this.server
      .to(`mining:${userId}`)
      .emit('mining_session_completed', data);
  }
}
