import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { publicUser } from '../common/mappers';
import { randomToken, verifyPassword } from '../common/crypto';

const SESSION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async userFromRequest(req: Request) {
    const token = req.cookies?.calora_session;
    if (!token) return null;
    const session = await this.prisma.session.findUnique({ where: { id: token }, include: { user: true } });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) await this.prisma.session.delete({ where: { id: token } }).catch(() => undefined);
      return null;
    }
    await this.prisma.session.update({
      where: { id: token },
      data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) }
    });
    return session.user;
  }

  async login(username: string, password: string, res: Response) {
    const user = await this.prisma.user.findFirst({
      where: { name: { equals: username, mode: 'insensitive' } },
      include: { profile: true }
    });
    if (!user || !verifyPassword(password || '', user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = randomToken();
    await this.prisma.session.create({
      data: { id: token, userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) }
    });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `calora_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${secure}`);
    return { user: publicUser(user, user.profile) };
  }

  async current(req: Request) {
    const user = await this.userFromRequest(req);
    if (!user) throw new UnauthorizedException('Authentication required');
    const profile = await this.prisma.nutritionProfile.findUnique({ where: { userId: user.id } });
    return { user: publicUser(user, profile) };
  }

  async logout(req: Request, res: Response) {
    const token = req.cookies?.calora_session;
    if (token) await this.prisma.session.delete({ where: { id: token } }).catch(() => undefined);
    res.setHeader('Set-Cookie', 'calora_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return { success: true };
  }
}
