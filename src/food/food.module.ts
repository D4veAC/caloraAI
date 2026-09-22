import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { FoodController } from './food.controller';
import { FoodService } from './food.service';

@Module({
  imports: [PlansModule],
  controllers: [FoodController],
  providers: [FoodService],
  exports: [FoodService]
})
export class FoodModule {}
