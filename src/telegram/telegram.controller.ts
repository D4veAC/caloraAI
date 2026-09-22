import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user';
import { SessionGuard } from '../common/guards/session.guard';
import { SessionOrTelegramGuard } from '../common/guards/session-or-telegram.guard';
import { TelegramService } from './telegram.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { safeEqual } from '../common/crypto';

@Controller('api/telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService
  ) {}

  @Get('status')
  @UseGuards(SessionOrTelegramGuard)
  status(@CurrentUser() user: User) {
    return this.telegram.statusForUser(user.id);
  }

  @Post('bind-token')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.CREATED)
  bindToken(@CurrentUser() user: User) {
    return this.telegram.createBindToken(user.id);
  }

  @Post('bind')
  @HttpCode(HttpStatus.OK)
  async bind(@Req() req: any, @Body() body: { token?: string; telegramUserId?: string }) {
    const token = this.config.get<string>('CALORA_WEBHOOK_TOKEN') || '';
    const auth = String(req.headers.authorization || '');
    if (!token || !safeEqual(auth, `Bearer ${token}`)) throw new UnauthorizedException('Valid importer token required');
    return this.telegram.bind(String(body.token || ''), String(body.telegramUserId || ''));
  }
}
