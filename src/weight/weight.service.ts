import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { validateWeight } from '../common/validation';
import { weightFor } from '../common/mappers';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class WeightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService
  ) {}

  async list(userId: string) {
    const rows = await this.prisma.weightLog.findMany({ where: { userId }, orderBy: { measuredAt: 'asc' } });
    return rows.map(weightFor);
  }

  async create(userId: string, body: Record<string, unknown>) {
    const entry = validateWeight(body);
    await this.prisma.weightLog.create({
      data: {
        id: entry.id,
        userId,
        weightKg: entry.weightKg,
        measuredAt: new Date(entry.measuredAt),
        source: entry.source
      }
    });
    await this.plans.refresh(userId);
    return entry;
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.weightLog.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Weight entry not found');
    await this.plans.refresh(userId);
    return { success: true };
  }
}
