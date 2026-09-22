import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { validateFood } from '../common/validation';
import { foodFor } from '../common/mappers';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class FoodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService
  ) {}

  async list(userId: string) {
    const rows = await this.prisma.foodLog.findMany({ where: { userId }, orderBy: { eatenAt: 'asc' } });
    return rows.map(foodFor);
  }

  async create(userId: string, body: Record<string, unknown>) {
    const entry = validateFood(body);
    try {
      await this.prisma.foodLog.create({
        data: {
          id: entry.id,
          userId,
          mealType: entry.category.toUpperCase(),
          foodName: entry.meal,
          calories: entry.kcal,
          proteinG: entry.protein,
          carbsG: entry.carbs,
          fatG: entry.fat,
          sugarG: entry.sugar,
          sodiumMg: entry.sodium,
          source: entry.source.toUpperCase(),
          confidence: entry.confidence,
          eatenAt: new Date(entry.createdAt)
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Duplicate entry');
      }
      throw error;
    }
    await this.plans.audit('FOOD_CREATED', { userId, actorUserId: userId, entityType: 'food_log', entityId: entry.id });
    await this.plans.refresh(userId);
    return entry;
  }

  async update(userId: string, id: string, body: Record<string, unknown>) {
    const entry = validateFood({ ...body, id });
    const result = await this.prisma.foodLog.updateMany({
      where: { id, userId },
      data: {
        mealType: entry.category.toUpperCase(),
        foodName: entry.meal,
        calories: entry.kcal,
        proteinG: entry.protein,
        carbsG: entry.carbs,
        fatG: entry.fat,
        sugarG: entry.sugar,
        sodiumMg: entry.sodium,
        source: entry.source.toUpperCase(),
        confidence: entry.confidence,
        eatenAt: new Date(entry.createdAt)
      }
    });
    if (!result.count) throw new NotFoundException('Food entry not found');
    await this.plans.refresh(userId);
    const row = await this.prisma.foodLog.findFirst({ where: { id, userId } });
    return row ? foodFor(row) : null;
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.foodLog.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Food entry not found');
    await this.plans.refresh(userId);
    return { success: true };
  }

  async summary(userId: string, date?: string) {
    const entries = await this.list(userId);
    const day = date || new Date().toISOString().slice(0, 10);
    const today = entries.filter(item => String(item.createdAt || '').startsWith(day));
    const total = today.reduce((acc, item) => ({
      kcal: acc.kcal + Number(item.kcal || 0),
      protein: acc.protein + Number(item.protein || 0),
      carbs: acc.carbs + Number(item.carbs || 0),
      fat: acc.fat + Number(item.fat || 0),
      count: acc.count + 1
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 });
    return { date: day, ...total, entries: today };
  }
}
