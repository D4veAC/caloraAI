import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [PlansModule],
  controllers: [AdminController]
})
export class AdminModule {}
