import { randomUUID } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { httpError, numeric } from './http';

export function validateProfile(input: Record<string, unknown> = {}, current: Record<string, unknown> = {}) {
  const pick = (key: string, allowed: string[], fallback: string) =>
    allowed.includes(String(input[key] ?? '')) ? String(input[key]) : fallback;
  return {
    bb: numeric(input.bb ?? current.bb, 'bb', 30, 350),
    tb: numeric(input.tb ?? current.tb, 'tb', 120, 230),
    age: numeric(input.age ?? current.age, 'age', 18, 100),
    sex: pick('sex', ['male', 'female'], String(current.sex || 'male')),
    activity: pick('activity', ['sedentary', 'light', 'moderate', 'active'], String(current.activity || 'moderate')),
    goal: pick('goal', ['lose', 'maintain', 'gain'], String(current.goal || 'maintain')),
    targetWeightKg: numeric(input.targetWeightKg ?? current.targetWeightKg ?? input.bb ?? current.bb, 'targetWeightKg', 30, 350),
    rateKgPerWeek: numeric(input.rateKgPerWeek ?? current.rateKgPerWeek ?? 0.25, 'rateKgPerWeek', 0, 1),
    dietaryPreference: pick('dietaryPreference', ['none', 'vegetarian', 'vegan', 'pescatarian'], String(current.dietaryPreference || 'none')),
    allergies: String(input.allergies ?? current.allergies ?? '').slice(0, 300),
    dislikedFoods: String(input.dislikedFoods ?? current.dislikedFoods ?? '').slice(0, 300),
    timezone: String(input.timezone ?? current.timezone ?? 'Asia/Bangkok').slice(0, 80)
  };
}

export function validateFood(input: Record<string, unknown> = {}) {
  const meal = String(input.meal || input.mealName || '').trim();
  if (!meal || meal.length > 120) throw httpError('Meal name is required', HttpStatus.BAD_REQUEST);
  const createdAt = new Date((input.createdAt || input.eatenAt || Date.now()) as string | number | Date);
  if (Number.isNaN(createdAt.getTime())) throw httpError('Invalid eatenAt', HttpStatus.BAD_REQUEST);
  const nutrient = (key: string, required = false) => {
    const value = numeric(input[key] ?? 0, key, 0, 100000);
    if (required && value <= 0) throw httpError(`Invalid ${key}`, HttpStatus.BAD_REQUEST);
    return value;
  };
  return {
    id: String(input.id || `food_${randomUUID()}`).slice(0, 100),
    meal,
    category: ['breakfast', 'lunch', 'dinner', 'snack'].includes(String(input.category || '').toLowerCase())
      ? String(input.category).toLowerCase()
      : 'snack',
    kcal: nutrient('kcal', true),
    protein: nutrient('protein'),
    carbs: nutrient('carbs'),
    fat: nutrient('fat'),
    sugar: nutrient('sugar'),
    sodium: nutrient('sodium'),
    source: String(input.source || 'MANUAL').slice(0, 30),
    confidence: input.confidence == null ? null : Math.min(1, Math.max(0, Number(input.confidence) || 0)),
    createdAt: createdAt.toISOString()
  };
}

export function validateWeight(input: Record<string, unknown> = {}) {
  const measuredAt = new Date((input.measuredAt as string) || Date.now());
  if (Number.isNaN(measuredAt.getTime())) throw httpError('Invalid measuredAt', HttpStatus.BAD_REQUEST);
  return {
    id: String(input.id || `weight_${randomUUID()}`),
    weightKg: numeric(input.weightKg, 'weightKg', 30, 350),
    measuredAt: measuredAt.toISOString(),
    source: String(input.source || 'MANUAL').slice(0, 30)
  };
}

export function validateActivity(input: Record<string, unknown> = {}) {
  const startedAt = new Date((input.startedAt as string) || Date.now());
  if (Number.isNaN(startedAt.getTime())) throw httpError('Invalid startedAt', HttpStatus.BAD_REQUEST);
  const provider = String(input.provider || 'MANUAL').toUpperCase();
  return {
    id: String(input.id || `activity_${randomUUID()}`),
    provider,
    providerActivityId: input.providerActivityId == null ? null : String(input.providerActivityId).slice(0, 120),
    activityType: String(input.activityType || input.name || 'OTHER').slice(0, 60),
    name: String(input.name || input.activityName || 'Activity').slice(0, 120),
    startedAt: startedAt.toISOString(),
    durationSeconds: input.durationSeconds == null ? null : numeric(input.durationSeconds, 'durationSeconds', 0, 604800),
    distanceMeters: input.distanceMeters == null ? null : numeric(input.distanceMeters, 'distanceMeters', 0, 1000000),
    estimatedEnergyKcal: input.estimatedEnergyKcal == null ? null : numeric(input.estimatedEnergyKcal, 'estimatedEnergyKcal', 0, 10000),
    energySource: String(input.energySource || 'USER_ESTIMATE').slice(0, 40),
    dataQuality: String(input.dataQuality || 'ESTIMATED').slice(0, 30),
    rawProviderReference: input.rawProviderReference == null ? null : String(input.rawProviderReference)
  };
}

export function healthConnectActivities(body: Record<string, unknown> = {}) {
  const records = (body.exercise || body.exercise_session || []) as Record<string, unknown>[];
  return (Array.isArray(records) ? records : []).map((record) => validateActivity({
    id: `hc_${String(record.id || randomUUID())}`,
    provider: 'HEALTH_CONNECT',
    providerActivityId: String(record.id || ''),
    activityType: record.type || 'WORKOUT',
    name: record.title || record.type || 'Health Connect activity',
    startedAt: record.start_time || Date.now(),
    durationSeconds: Number(record.duration_seconds) || ((record.start_time && record.end_time)
      ? Math.max(0, (new Date(String(record.end_time)).getTime() - new Date(String(record.start_time)).getTime()) / 1000)
      : null),
    distanceMeters: Number(record.distance_meters || record.total_distance_meters) || null,
    estimatedEnergyKcal: Number(record.total_calories || record.calories) || null,
    energySource: 'PROVIDER_ESTIMATE',
    dataQuality: 'ESTIMATED'
  }));
}
