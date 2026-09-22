import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hashPassword } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_USERS = process.env.NODE_ENV === 'production' ? [] : [
  { id: 'dave', name: 'Dave', email: 'dave@local.test', password: '1234', role: 'USER', profile: { bb: 68, tb: 175, age: 25, sex: 'male', activity: 'moderate', goal: 'maintain' } },
  { id: 'alex', name: 'Alex', email: 'alex@local.test', password: '5678', role: 'USER', profile: { bb: 55, tb: 165, age: 24, sex: 'female', activity: 'light', goal: 'maintain' } },
  { id: 'aifih', name: 'Aifih', email: 'aifih@local.test', password: '1414', role: 'USER', profile: { bb: 70, tb: 172, age: 22, sex: 'male', activity: 'moderate', goal: 'maintain' } },
  { id: 'admin-local', name: 'Admin', email: 'admin@local.test', password: '2468', role: 'ADMIN', profile: { bb: 70, tb: 175, age: 30, sex: 'male', activity: 'moderate', goal: 'maintain' } }
];

const MENUS = [
  { id: 'P04', name: 'Ayam panggang, nasi, dan sayur', mealType: 'LUNCH', calories: 620, proteinG: 48, carbsG: 70, fatG: 16, allergens: [], dietaryTags: ['none'], servingSize: '180 g protein + sides' },
  { id: 'P07', name: 'Tempe, nasi merah, dan sayur', mealType: 'LUNCH', calories: 590, proteinG: 35, carbsG: 78, fatG: 16, allergens: ['soy'], dietaryTags: ['vegetarian', 'vegan'], servingSize: '1 serving' },
  { id: 'P09', name: 'Ikan panggang dan sayur', mealType: 'LUNCH', calories: 570, proteinG: 46, carbsG: 50, fatG: 20, allergens: ['fish'], dietaryTags: ['pescatarian'], servingSize: '1 serving' },
  { id: 'P11', name: 'Ayam lada hitam dan kentang', mealType: 'DINNER', calories: 680, proteinG: 53, carbsG: 68, fatG: 22, allergens: [], dietaryTags: ['none'], servingSize: '1 serving' },
  { id: 'P13', name: 'Tofu teriyaki dan edamame', mealType: 'DINNER', calories: 640, proteinG: 39, carbsG: 72, fatG: 20, allergens: ['soy'], dietaryTags: ['vegetarian', 'vegan'], servingSize: '1 serving' },
  { id: 'P15', name: 'Salmon, kentang, dan salad', mealType: 'DINNER', calories: 700, proteinG: 50, carbsG: 58, fatG: 27, allergens: ['fish'], dietaryTags: ['pescatarian'], servingSize: '1 serving' }
];

function configuredUsers() {
  if (!process.env.CALORA_USERS_JSON) return DEFAULT_USERS;
  const users = JSON.parse(process.env.CALORA_USERS_JSON);
  if (!Array.isArray(users) || users.some(user => !user.id || !user.name || (!user.password && !user.passwordHash))) {
    throw new Error('CALORA_USERS_JSON is invalid');
  }
  return users;
}

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    for (const user of configuredUsers()) {
      const passwordHash = user.passwordHash || hashPassword(user.password);
      const existing = await this.prisma.user.findFirst({ where: { OR: [{ id: user.id }, { name: { equals: user.name, mode: 'insensitive' } }] } });
      if (existing) {
        await this.prisma.nutritionProfile.upsert({
          where: { userId: existing.id },
          update: {},
          create: {
            userId: existing.id,
            age: (user.profile || {}).age || 25,
            sex: (user.profile || {}).sex || 'male',
            heightCm: (user.profile || {}).tb || 171,
            weightKg: (user.profile || {}).bb || 65,
            activityLevel: (user.profile || {}).activity || 'moderate',
            goalType: (user.profile || {}).goal || 'maintain',
            targetWeightKg: (user.profile || {}).targetWeightKg || (user.profile || {}).bb || 65,
            rateKgPerWeek: (user.profile || {}).rateKgPerWeek || 0.25,
            dietaryPreference: (user.profile || {}).dietaryPreference || 'none',
            allergies: (user.profile || {}).allergies || '',
            dislikedFoods: (user.profile || {}).dislikedFoods || '',
            timezone: (user.profile || {}).timezone || 'Asia/Bangkok'
          }
        });
        continue;
      }
      await this.prisma.user.create({
        data: {
          id: user.id,
          name: user.name,
          email: user.email || null,
          passwordHash,
          role: user.role || 'USER'
        }
      });
      const p = user.profile || {};
      await this.prisma.nutritionProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          age: p.age || 25,
          sex: p.sex || 'male',
          heightCm: p.tb || p.heightCm || 171,
          weightKg: p.bb || p.weightKg || 65,
          activityLevel: p.activity || 'moderate',
          goalType: p.goal || 'maintain',
          targetWeightKg: p.targetWeightKg || p.bb || 65,
          rateKgPerWeek: p.rateKgPerWeek || 0.25,
          dietaryPreference: p.dietaryPreference || 'none',
          allergies: p.allergies || '',
          dislikedFoods: p.dislikedFoods || '',
          timezone: p.timezone || 'Asia/Bangkok'
        }
      });
    }
    const menuCount = await this.prisma.menu.count();
    if (!menuCount) {
      await this.prisma.menu.createMany({
        data: MENUS.map(menu => ({
          ...menu,
          allergens: menu.allergens as Prisma.InputJsonValue,
          dietaryTags: menu.dietaryTags as Prisma.InputJsonValue,
          inventoryAvailable: 50,
          active: true
        }))
      });
    }
  }
}
