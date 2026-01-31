import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret-key-change-in-production',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    console.log(`[JWT DEBUG] Token payload: sub=${payload.sub}, email=${payload.email}`);

    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      console.log(`[JWT DEBUG] User not found for token sub=${payload.sub}`);
      throw new UnauthorizedException();
    }

    console.log(`[JWT DEBUG] Authenticated as: id=${user.id}, email=${user.email}`);
    return user;
  }
}
