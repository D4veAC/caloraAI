import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { safeEqual } from '../crypto';

@Injectable()
export class SessionOrTelegramGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const sessionUser = await this.auth.userFromRequest(req);
    if (sessionUser) {
      req.user = sessionUser;
      return true;
    }
    const token = this.config.get<string>('CALORA_WEBHOOK_TOKEN') || '';
    const auth = String(req.headers.authorization || '');
    if (!token || !safeEqual(auth, `Bearer ${token}`)) throw new UnauthorizedException('Authentication required');
    const telegramUserId = String(req.headers['x-telegram-user-id'] || req.query.telegramUserId || req.body?.telegramUserId || '');
    if (!telegramUserId) throw new UnauthorizedException('Authentication required');
    const connection = await this.prisma.telegramConnection.findUnique({
      where: { telegramUserId },
      include: { user: true }
    });
    if (!connection) throw new NotFoundException('Telegram account is not connected');
    req.user = connection.user;
    req.telegramUserId = telegramUserId;
    return true;
  }
}
