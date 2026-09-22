import { ActivityLog, FoodLog, NutritionProfile, User, WeightLog } from '@prisma/client';

export function profileFor(row: NutritionProfile | null) {
  if (!row) return null;
  return {
    bb: row.weightKg,
    tb: row.heightCm,
    age: row.age,
    sex: row.sex,
    activity: row.activityLevel,
    goal: row.goalType,
    targetWeightKg: row.targetWeightKg,
    rateKgPerWeek: row.rateKgPerWeek,
    dietaryPreference: row.dietaryPreference,
    allergies: row.allergies,
    dislikedFoods: row.dislikedFoods,
    timezone: row.timezone,
    version: row.version
  };
}

export function foodFor(row: FoodLog) {
  return {
    id: row.id,
    meal: row.foodName,
    category: row.mealType.toLowerCase(),
    kcal: row.calories,
    protein: row.proteinG,
    carbs: row.carbsG,
    fat: row.fatG,
    sugar: row.sugarG,
    sodium: row.sodiumMg,
    source: row.source,
    confidence: row.confidence,
    createdAt: row.eatenAt.toISOString()
  };
}

export function weightFor(row: WeightLog) {
  return {
    id: row.id,
    weightKg: row.weightKg,
    measuredAt: row.measuredAt.toISOString(),
    source: row.source,
    createdAt: row.createdAt.toISOString()
  };
}

export function activityFor(row: ActivityLog) {
  return {
    id: row.id,
    provider: row.provider,
    providerActivityId: row.providerActivityId,
    activityType: row.activityType,
    name: row.activityName,
    startedAt: row.startedAt.toISOString(),
    durationSeconds: row.durationSeconds,
    duration: row.durationSeconds == null ? null : Math.round(row.durationSeconds / 60),
    distanceMeters: row.distanceMeters,
    distance: row.distanceMeters == null ? null : Number((row.distanceMeters / 1000).toFixed(2)),
    estimatedEnergyKcal: row.estimatedEnergyKcal,
    calories: row.estimatedEnergyKcal,
    energySource: row.energySource,
    dataQuality: row.dataQuality,
    source: row.provider,
    timestamp: row.startedAt.getTime(),
    date: row.startedAt.toDateString()
  };
}

export function publicUser(user: User, profile: NutritionProfile | null) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, profile: profileFor(profile) };
}
