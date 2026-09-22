import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { activityFor, foodFor, profileFor, weightFor } from '../common/mappers';
import { calculateDailyNutritionState, calculateNutritionTargets, recommendNextMeal } from '../domain/nutrition';
import { calculateRollingNutritionState, explainPlan, generateTomorrowCateringPlan } from '../domain/catering';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  cutoffHour() {
    return Number(process.env.CALORA_CATERING_CUTOFF_HOUR || 20);
  }

  async audit(eventType: string, { userId = null, actorUserId = null, entityType = null, entityId = null, detail = {} }: any = {}) {
    await this.prisma.auditEvent.create({
      data: {
        id: `audit_${randomUUID()}`,
        userId,
        actorUserId,
        eventType,
        entityType,
        entityId,
        detail: detail as Prisma.InputJsonValue
      }
    });
  }

  async listMenus() {
    const rows = await this.prisma.menu.findMany({ where: { active: true } });
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      mealType: row.mealType,
      calories: row.calories,
      proteinG: row.proteinG,
      carbsG: row.carbsG,
      fatG: row.fatG,
      allergens: row.allergens,
      dietaryTags: row.dietaryTags,
      inventoryAvailable: row.inventoryAvailable,
      servingSize: row.servingSize,
      active: row.active
    }));
  }

  async recentMenuIds(userId: string) {
    const meals = await this.prisma.cateringMeal.findMany({
      where: { menuId: { not: null }, plan: { userId } },
      orderBy: { plan: { planDate: 'desc' } },
      take: 4
    });
    return meals.map(row => row.menuId).filter(Boolean);
  }

  async getPlan(userId: string, date: string) {
    const row = await this.prisma.adaptivePlan.findUnique({
      where: { userId_planDate: { userId, planDate: date } },
      include: { meals: { include: { menu: true } } }
    });
    if (!row) return null;
    const lunch = row.meals.find(meal => meal.mealType === 'LUNCH');
    return {
      id: row.id,
      planDate: row.planDate,
      generatedAt: row.generatedAt.toISOString(),
      baseDailyTarget: row.baseDailyCalorieTarget,
      effectiveDailyTarget: row.effectiveDailyCalorieTarget,
      cateringAllocation: row.cateringCalorieAllocation,
      proteinTargetG: row.proteinTargetG,
      carbsTargetG: row.carbsTargetG,
      fatTargetG: row.fatTargetG,
      confidence: row.confidence,
      stateVersion: row.stateVersion,
      engineVersion: row.engineVersion,
      explanationCodes: row.explanationCodes,
      status: row.status,
      rollingState: row.inputSnapshot,
      lunch: lunch && {
        id: lunch.menuId,
        name: lunch.menu?.name || 'Unassigned',
        mealType: lunch.mealType,
        calories: lunch.calories,
        proteinG: lunch.proteinG,
        carbsG: lunch.carbsG,
        fatG: lunch.fatG,
        status: lunch.status
      },
      dinner: null
    };
  }

  async savePlan(userId: string, plan: any) {
    const existing = await this.getPlan(userId, plan.planDate);
    if (existing?.status === 'LOCKED') return existing;
    const id = existing?.id || `plan_${randomUUID()}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.adaptivePlan.upsert({
        where: { userId_planDate: { userId, planDate: plan.planDate } },
        create: {
          id,
          userId,
          planDate: plan.planDate,
          generatedAt: new Date(plan.generatedAt),
          baseDailyCalorieTarget: plan.baseDailyTarget,
          effectiveDailyCalorieTarget: plan.effectiveDailyTarget,
          cateringCalorieAllocation: plan.cateringAllocation,
          proteinTargetG: plan.proteinTargetG,
          carbsTargetG: plan.carbsTargetG,
          fatTargetG: plan.fatTargetG,
          confidence: plan.confidence,
          stateVersion: plan.stateVersion,
          engineVersion: plan.engineVersion,
          explanationCodes: plan.explanationCodes as Prisma.InputJsonValue,
          status: plan.status,
          inputSnapshot: plan.rollingState as Prisma.InputJsonValue
        },
        update: {
          generatedAt: new Date(plan.generatedAt),
          baseDailyCalorieTarget: plan.baseDailyTarget,
          effectiveDailyCalorieTarget: plan.effectiveDailyTarget,
          cateringCalorieAllocation: plan.cateringAllocation,
          proteinTargetG: plan.proteinTargetG,
          carbsTargetG: plan.carbsTargetG,
          fatTargetG: plan.fatTargetG,
          confidence: plan.confidence,
          stateVersion: plan.stateVersion,
          engineVersion: plan.engineVersion,
          explanationCodes: plan.explanationCodes as Prisma.InputJsonValue,
          status: plan.status,
          inputSnapshot: plan.rollingState as Prisma.InputJsonValue
        }
      });
      await tx.cateringMeal.deleteMany({ where: { adaptivePlanId: id } });
      if (plan.lunch) {
        await tx.cateringMeal.create({
          data: {
            id: `meal_${randomUUID()}`,
            adaptivePlanId: id,
            mealType: 'LUNCH',
            menuId: plan.lunch.id,
            calories: plan.lunch.calories,
            proteinG: plan.lunch.proteinG,
            carbsG: plan.lunch.carbsG,
            fatG: plan.lunch.fatG,
            status: plan.status
          }
        });
      }
    });
    return this.getPlan(userId, plan.planDate);
  }

  async ensurePlan(userId: string, date = new Date()) {
    const profileRow = await this.prisma.nutritionProfile.findUnique({ where: { userId } });
    const profile = profileFor(profileRow);
    const foodLogs = (await this.prisma.foodLog.findMany({ where: { userId } })).map(foodFor);
    const weightLogs = (await this.prisma.weightLog.findMany({ where: { userId } })).map(weightFor);
    const activityLogs = (await this.prisma.activityLog.findMany({ where: { userId } })).map(activityFor);
    const rollingState = calculateRollingNutritionState({ foodLogs, weightLogs, activityLogs, profile, windowDays: 7, now: date });
    const existing = await this.getPlan(userId, new Date(date.getTime() + 86_400_000).toISOString().slice(0, 10));
    const plan = existing?.status === 'LOCKED'
      ? existing
      : await this.savePlan(userId, generateTomorrowCateringPlan({
        profile,
        rollingState,
        menus: await this.listMenus(),
        recentMenuIds: await this.recentMenuIds(userId),
        now: date,
        cutoffHour: this.cutoffHour()
      }));
    return {
      ...plan,
      explanations: explainPlan({ ...plan, rollingState: plan?.rollingState || rollingState }),
      targets: calculateNutritionTargets(profile || {})
    };
  }

  async refresh(userId: string) {
    try {
      return await this.ensurePlan(userId);
    } catch (error) {
      console.error('Plan recompute failed', (error as Error).message);
      return null;
    }
  }

  async dashboard(userId: string) {
    const profile = profileFor(await this.prisma.nutritionProfile.findUnique({ where: { userId } }));
    const foodLogs = (await this.prisma.foodLog.findMany({ where: { userId } })).map(foodFor);
    const activities = (await this.prisma.activityLog.findMany({ where: { userId } })).map(activityFor);
    const weights = (await this.prisma.weightLog.findMany({ where: { userId } })).map(weightFor);
    const targets = calculateNutritionTargets(profile || {});
    const today = calculateDailyNutritionState(foodLogs, targets);
    const tomorrow = await this.ensurePlan(userId);
    const tonight = recommendNextMeal(today, profile || {}, foodLogs);
    const weightDelta = profile && profile.targetWeightKg != null
      ? Number((Number(profile.bb) - Number(profile.targetWeightKg)).toFixed(1))
      : 0;
    return {
      profile,
      foodLogs,
      activities,
      weights,
      today,
      tonight,
      tomorrow,
      targets,
      goalSummary: {
        currentKg: profile?.bb,
        targetKg: profile?.targetWeightKg,
        deltaKg: weightDelta,
        label: profile?.goal === 'lose' && weightDelta > 0
          ? `Lose ${weightDelta} kg`
          : profile?.goal === 'gain' && weightDelta < 0
            ? `Gain ${Math.abs(weightDelta)} kg`
            : 'Maintain weight'
      }
    };
  }

  async adminDashboard() {
    const users = await this.prisma.user.findMany({ where: { role: 'USER' } });
    for (const user of users) await this.refresh(user.id);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const plans = await this.prisma.adaptivePlan.findMany({
      where: { planDate: tomorrow },
      include: {
        user: true,
        meals: true
      },
      orderBy: { user: { name: 'asc' } }
    });
    const profiles = await this.prisma.nutritionProfile.findMany({
      where: { userId: { in: plans.map(plan => plan.userId) } }
    });
    const profileMap = new Map(profiles.map(item => [item.userId, item]));
    const mapped = plans.map(row => ({
      id: row.id,
      userId: row.userId,
      userName: row.user.name,
      planDate: row.planDate,
      effectiveDailyTarget: row.effectiveDailyCalorieTarget,
      cateringAllocation: row.cateringCalorieAllocation,
      status: row.status,
      confidence: row.confidence,
      allergies: profileMap.get(row.userId)?.allergies || '',
      dietaryPreference: profileMap.get(row.userId)?.dietaryPreference || 'none',
      explanationCodes: row.explanationCodes,
      meals: row.meals.map(meal => ({
        mealType: meal.mealType,
        menuId: meal.menuId,
        calories: meal.calories,
        proteinG: meal.proteinG
      }))
    }));
    return {
      date: tomorrow,
      metrics: {
        tomorrowOrders: mapped.length,
        confirmedPlans: mapped.filter(p => p.status === 'CONFIRMED').length,
        awaitingReview: mapped.filter(p => p.status === 'DRAFT').length,
        lunchPortions: mapped.filter(p => p.meals.some(m => m.mealType === 'LUNCH')).length
      },
      plans: mapped
    };
  }

  async setPlanStatus(id: string, status: string) {
    await this.prisma.adaptivePlan.update({ where: { id }, data: { status } });
    await this.prisma.cateringMeal.updateMany({ where: { adaptivePlanId: id }, data: { status } });
  }
}
