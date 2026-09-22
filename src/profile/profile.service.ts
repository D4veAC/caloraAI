import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { profileFor } from '../common/mappers';
import { validateProfile } from '../common/validation';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService
  ) {}

  async get(userId: string) {
    return profileFor(await this.prisma.nutritionProfile.findUnique({ where: { userId } }));
  }

  async update(userId: string, body: Record<string, unknown>) {
    const current = await this.get(userId) || {};
    const p = validateProfile(body, current);
    await this.prisma.nutritionProfile.update({
      where: { userId },
      data: {
        age: p.age,
        sex: p.sex,
        heightCm: p.tb,
        weightKg: p.bb,
        activityLevel: p.activity,
        goalType: p.goal,
        targetWeightKg: p.targetWeightKg,
        rateKgPerWeek: p.rateKgPerWeek,
        dietaryPreference: p.dietaryPreference,
        allergies: p.allergies,
        dislikedFoods: p.dislikedFoods,
        timezone: p.timezone || 'Asia/Bangkok',
        version: { increment: 1 }
      }
    });
    await this.plans.audit('PROFILE_UPDATED', { userId, actorUserId: userId, entityType: 'nutrition_profile', entityId: userId });
    await this.plans.refresh(userId);
    return this.get(userId);
  }
}
