import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { WeightController } from './weight.controller';
import { WeightService } from './weight.service';

@Module({
  imports: [PlansModule],
  controllers: [WeightController],
  providers: [WeightService]
})
export class WeightModule {}
