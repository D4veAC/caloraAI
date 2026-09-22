import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user';
import { ImporterGuard } from '../common/guards/importer.guard';
import { SessionGuard } from '../common/guards/session.guard';
import { ActivityService } from './activity.service';

@Controller('api/activity')
export class ActivityController {
  constructor(private readonly activities: ActivityService) {}

  @Get()
  @UseGuards(SessionGuard)
  list(@CurrentUser() user: User) {
    return this.activities.list(user.id);
  }

  @Post()
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.activities.create(user.id, body);
  }

  @Post('import')
  @UseGuards(ImporterGuard)
  @HttpCode(HttpStatus.CREATED)
  importHealthConnect(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.activities.importHealthConnect(user.id, body);
  }

  @Delete(':id')
  @UseGuards(SessionGuard)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.activities.remove(user.id, decodeURIComponent(id));
  }
}
