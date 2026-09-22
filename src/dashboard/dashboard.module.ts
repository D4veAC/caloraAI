import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [PlansModule],
  controllers: [DashboardController]
})
export class DashboardModule {}
