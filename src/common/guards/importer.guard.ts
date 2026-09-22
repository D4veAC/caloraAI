import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { safeEqual } from '../crypto';

@Injectable()
export class ImporterGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = this.config.get<string>('CALORA_WEBHOOK_TOKEN') || '';
    const auth = String(req.headers.authorization || '');
    if (!token || !safeEqual(auth, `Bearer ${token}`)) throw new UnauthorizedException('Valid importer token required');
    const user = await this.prisma.user.findUnique({ where: { id: String(req.headers['x-calora-user'] || '') } });
    if (!user) throw new UnauthorizedException('Valid importer token required');
    req.user = user;
    return true;
  }
}
