import { BadRequestException, Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user';
import { AdminGuard } from '../common/guards/admin.guard';
import { PlansService } from '../plans/plans.service';

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly plans: PlansService) {}

  @Get('dashboard')
  async dashboard(@CurrentUser() admin: User) {
    const data = await this.plans.adminDashboard();
    return { ...data, actor: { id: admin.id, name: admin.name } };
  }

  @Put('plans/:id/status')
  async setStatus(@CurrentUser() admin: User, @Param('id') id: string, @Body() body: { status?: string }) {
    const status = String(body.status || '');
    if (!['DRAFT', 'CONFIRMED', 'LOCKED', 'FULFILLED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('Invalid plan status');
    }
    await this.plans.setPlanStatus(decodeURIComponent(id), status);
    await this.plans.audit('PLAN_STATUS_CHANGED', {
      actorUserId: admin.id,
      entityType: 'adaptive_plan',
      entityId: id,
      detail: { status }
    });
    return { success: true };
  }
}
