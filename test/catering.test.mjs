import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_PROVIDER_POLICY, calculateRollingNutritionState, generateTomorrowCateringPlan } from '../js/domain/catering.mjs';

const profile = { bb: 70, tb: 175, age: 30, sex: 'male', activity: 'moderate', goal: 'maintain' };
const menus = [
  { id: 'L1', mealType: 'LUNCH', calories: 620, proteinG: 48, active: true, inventoryAvailable: 10, allergens: [], dietaryTags: ['none'] },
  { id: 'D1', mealType: 'DINNER', calories: 680, proteinG: 53, active: true, inventoryAvailable: 10, allergens: [], dietaryTags: ['none'] }
];
const log = (day, kcal, protein = 120) => ({ id: day, meal: day, kcal, protein, carbs: 200, fat: 60, createdAt: `${day}T12:00:00Z` });

test('one high day has low confidence and cannot create calorie debt', () => {
  const state = calculateRollingNutritionState({ foodLogs: [log('2026-09-21', 4000)], profile, now: new Date('2026-09-22T10:00:00Z') });
  const plan = generateTomorrowCateringPlan({ profile, rollingState: state, menus, now: new Date('2026-09-22T10:00:00Z') });
  assert.equal(state.confidence, 'LOW');
  assert.equal(plan.effectiveDailyTarget, plan.baseDailyTarget);
  assert.ok(plan.explanationCodes.includes('INSUFFICIENT_LOGGING'));
});

test('persistent protein deficit changes composition without changing energy target', () => {
  const foodLogs = Array.from({ length: 7 }, (_, index) => {
    const day = String(16 + index).padStart(2, '0');
    return [0, 1, 2].map(meal => ({ ...log(`2026-09-${day}`, 800, 25), id: `${day}-${meal}`, kcal: 800 / 3, protein: 25 / 3 }));
  }).flat();
  const state = calculateRollingNutritionState({ foodLogs, profile, now: new Date('2026-09-22T10:00:00Z') });
  const plan = generateTomorrowCateringPlan({ profile, rollingState: state, menus, now: new Date('2026-09-22T10:00:00Z') });
  assert.equal(state.confidence, 'HIGH');
  assert.equal(plan.effectiveDailyTarget, plan.baseDailyTarget);
  assert.ok(plan.adaptations.includes('PROTEIN_UP'));
});

test('Strava cannot influence adaptive plans by default', () => {
  assert.equal(ACTIVITY_PROVIDER_POLICY.STRAVA.canInfluenceAdaptivePlan, false);
});

test('on-target weight trajectory prevents an unjustified energy correction', () => {
  const foodLogs = Array.from({ length: 7 }, (_, index) => {
    const day = String(16 + index).padStart(2, '0');
    return [0, 1, 2].map(meal => ({ ...log(`2026-09-${day}`, 1100, 45), id: `${day}-${meal}`, kcal: 1100 }));
  }).flat();
  const weightLogs = [
    { weightKg: 70, measuredAt: '2026-09-16T08:00:00Z' },
    { weightKg: 70, measuredAt: '2026-09-22T08:00:00Z' }
  ];
  const state = calculateRollingNutritionState({ foodLogs, weightLogs, profile, now: new Date('2026-09-22T10:00:00Z') });
  const plan = generateTomorrowCateringPlan({ profile, rollingState: state, menus, now: new Date('2026-09-22T10:00:00Z') });
  assert.equal(state.weightTrajectoryOnTarget, true);
  assert.equal(plan.effectiveDailyTarget, plan.baseDailyTarget);
  assert.ok(plan.explanationCodes.includes('WEIGHT_TRAJECTORY_ON_TARGET'));
});

test('persistent deviation plus off-target trajectory uses only bounded adjustment', () => {
  const foodLogs = Array.from({ length: 7 }, (_, index) => {
    const day = String(16 + index).padStart(2, '0');
    return [0, 1, 2].map(meal => ({ ...log(`2026-09-${day}`, 1100, 45), id: `${day}-${meal}`, kcal: 1100 }));
  }).flat();
  const weightLogs = [
    { weightKg: 70, measuredAt: '2026-09-16T08:00:00Z' },
    { weightKg: 70.6, measuredAt: '2026-09-22T08:00:00Z' }
  ];
  const state = calculateRollingNutritionState({ foodLogs, weightLogs, profile, now: new Date('2026-09-22T10:00:00Z') });
  const plan = generateTomorrowCateringPlan({ profile, rollingState: state, menus, now: new Date('2026-09-22T10:00:00Z') });
  assert.equal(state.confidence, 'HIGH');
  assert.equal(state.weightTrajectoryOnTarget, false);
  assert.equal(plan.effectiveDailyTarget, plan.baseDailyTarget - 100);
});

test('cutoff locks tomorrow plan', () => {
  const state = calculateRollingNutritionState({ profile, now: new Date('2026-09-22T21:00:00') });
  const plan = generateTomorrowCateringPlan({ profile, rollingState: state, menus, now: new Date('2026-09-22T21:00:00'), cutoffHour: 20 });
  assert.equal(plan.status, 'LOCKED');
});
