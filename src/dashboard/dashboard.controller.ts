import { Controller, Get, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user';
import { SessionGuard } from '../common/guards/session.guard';
import { PlansService } from '../plans/plans.service';

@Controller('api/dashboard')
@UseGuards(SessionGuard)
export class DashboardController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.plans.dashboard(user.id);
  }
}
