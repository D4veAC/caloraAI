import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('api/session')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  login(@Body() body: { username?: string; password?: string }, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(String(body.username || '').trim(), String(body.password || ''), res);
  }

  @Get()
  current(@Req() req: Request) {
    return this.auth.current(req);
  }

  @Delete()
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }
}
