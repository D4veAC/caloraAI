import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomToken, sha256 } from '../common/crypto';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class TelegramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService
  ) {}

  async statusForUser(userId: string) {
    const row = await this.prisma.telegramConnection.findUnique({ where: { userId } });
    return row
      ? { connected: true, telegramUserId: row.telegramUserId, connectedAt: row.connectedAt.toISOString() }
      : { connected: false };
  }

  async createBindToken(userId: string) {
    const token = randomToken(24);
    const minutes = Number(process.env.TELEGRAM_BIND_TTL_MINUTES || 30);
    const expiresAt = new Date(Date.now() + minutes * 60_000);
    await this.prisma.telegramBindToken.create({
      data: { tokenHash: sha256(token), userId, expiresAt }
    });
    await this.plans.audit('TELEGRAM_BIND_TOKEN_CREATED', { userId, actorUserId: userId });
    const username = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
    return {
      expiresAt: expiresAt.toISOString(),
      startPayload: `bind_${token}`,
      deepLink: username ? `https://t.me/${username}?start=bind_${token}` : null
    };
  }

  async bind(token: string, telegramUserId: string) {
    if (!token || !telegramUserId) throw new BadRequestException('Token and Telegram user ID are required');
    const hash = sha256(token);
    const bind = await this.prisma.telegramBindToken.findUnique({ where: { tokenHash: hash } });
    if (!bind || bind.usedAt || bind.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Bind token is invalid, expired, or already used');
    }
    const conflict = await this.prisma.telegramConnection.findUnique({ where: { telegramUserId: String(telegramUserId) } });
    if (conflict && conflict.userId !== bind.userId) {
      throw new ConflictException('Telegram account is already connected');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.telegramConnection.upsert({
        where: { userId: bind.userId },
        create: { userId: bind.userId, telegramUserId: String(telegramUserId) },
        update: { telegramUserId: String(telegramUserId), connectedAt: new Date() }
      });
      await tx.telegramBindToken.update({ where: { tokenHash: hash }, data: { usedAt: new Date() } });
    });
    await this.plans.audit('TELEGRAM_BOUND', { userId: bind.userId, entityType: 'telegram_connection', entityId: String(telegramUserId) });
    return { success: true };
  }
}
