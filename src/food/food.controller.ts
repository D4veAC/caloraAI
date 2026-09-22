import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user';
import { SessionOrTelegramGuard } from '../common/guards/session-or-telegram.guard';
import { FoodService } from './food.service';

@Controller('api/food')
@UseGuards(SessionOrTelegramGuard)
export class FoodController {
  constructor(private readonly food: FoodService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.food.list(user.id);
  }

  @Get('summary')
  summary(@CurrentUser() user: User, @Query('date') date?: string) {
    return this.food.summary(user.id, date);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.food.create(user.id, body.food && typeof body.food === 'object' ? body.food as Record<string, unknown> : body);
  }

  @Put(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.food.update(user.id, decodeURIComponent(id), body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.food.remove(user.id, decodeURIComponent(id));
  }
}
