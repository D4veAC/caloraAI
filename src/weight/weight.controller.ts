import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user';
import { SessionGuard } from '../common/guards/session.guard';
import { WeightService } from './weight.service';

@Controller('api/weight')
@UseGuards(SessionGuard)
export class WeightController {
  constructor(private readonly weights: WeightService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.weights.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.weights.create(user.id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.weights.remove(user.id, decodeURIComponent(id));
  }
}
