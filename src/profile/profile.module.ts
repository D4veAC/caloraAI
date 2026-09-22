import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [PlansModule],
  controllers: [ProfileController],
  providers: [ProfileService]
})
export class ProfileModule {}
