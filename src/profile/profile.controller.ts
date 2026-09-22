import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user';
import { SessionGuard } from '../common/guards/session.guard';
import { ProfileService } from './profile.service';

@Controller('api/profile')
@UseGuards(SessionGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.profiles.get(user.id);
  }

  @Put()
  update(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.profiles.update(user.id, body);
  }
}
