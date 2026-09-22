import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActivityModule } from './activity/activity.module';
import { AdminModule } from './admin/admin.module';
import { AnalyzeModule } from './analyze/analyze.module';
import { AuthModule } from './auth/auth.module';
import { SecurityMiddleware } from './common/security.middleware';
import { DashboardModule } from './dashboard/dashboard.module';
import { FoodModule } from './food/food.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { SeedService } from './seed/seed.service';
import { TelegramModule } from './telegram/telegram.module';
import { WeightModule } from './weight/weight.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProfileModule,
    FoodModule,
    WeightModule,
    ActivityModule,
    DashboardModule,
    TelegramModule,
    AdminModule,
    AnalyzeModule
  ],
  controllers: [HealthController],
  providers: [SeedService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
