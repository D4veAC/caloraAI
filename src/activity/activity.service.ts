import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { healthConnectActivities, validateActivity } from '../common/validation';
import { activityFor } from '../common/mappers';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService
  ) {}

  async list(userId: string) {
    const rows = await this.prisma.activityLog.findMany({ where: { userId }, orderBy: { startedAt: 'asc' } });
    return rows.map(activityFor);
  }

  async create(userId: string, body: Record<string, unknown>, forceManual = true) {
    if (forceManual) body.provider = 'MANUAL';
    const entry = validateActivity(body);
    try {
      await this.prisma.activityLog.create({
        data: {
          id: entry.id,
          userId,
          provider: entry.provider,
          providerActivityId: entry.providerActivityId,
          activityType: entry.activityType,
          activityName: entry.name,
          startedAt: new Date(entry.startedAt),
          durationSeconds: entry.durationSeconds,
          distanceMeters: entry.distanceMeters,
          estimatedEnergyKcal: entry.estimatedEnergyKcal,
          energySource: entry.energySource,
          dataQuality: entry.dataQuality,
          rawProviderReference: entry.rawProviderReference
        }
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
    await this.plans.refresh(userId);
    const row = await this.prisma.activityLog.findFirst({
      where: { userId, provider: entry.provider, providerActivityId: entry.providerActivityId }
    });
    return row ? activityFor(row) : entry;
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.activityLog.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException('Activity not found');
    await this.plans.refresh(userId);
    return { success: true };
  }

  async importHealthConnect(userId: string, body: Record<string, unknown>) {
    const entries = healthConnectActivities(body);
    if (!entries.length) throw new BadRequestException('No supported activity records found');
    for (const entry of entries) {
      await this.create(userId, entry as unknown as Record<string, unknown>, false);
    }
    return { success: true, entries };
  }
}
