import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BridgeSecretGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-bridge-secret'];
    const expectedSecret = this.configService.get<string>('BRIDGE_SECRET');

    if (!expectedSecret) {
      throw new UnauthorizedException('Bridge secret not configured');
    }

    if (!secret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid bridge secret');
    }

    return true;
  }
}
