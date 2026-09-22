import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [PlansModule],
  controllers: [TelegramController],
  providers: [TelegramService]
})
export class TelegramModule {}
