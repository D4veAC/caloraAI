import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateDailyNutrition,
  calculateDailyNutritionState,
  calculateNextMealConstraints,
  calculateNutritionTargets,
  recommendNextMeal
} from '../js/domain/nutrition.mjs';

const today = new Date('2026-09-22T12:00:00Z');
const targets = calculateNutritionTargets({ age: 30, bb: 70, tb: 175, sex: 'male', activity: 'moderate', goal: 'lose', rateKgPerWeek: 0.25 }, today);

test('calculates deterministic nutrition targets without an LLM', () => {
  assert.equal(targets.bmr, 1649);
  assert.equal(targets.tdee, 2556);
  assert.equal(targets.kcal, 2281);
  assert.ok(targets.protein > 0 && targets.carbs > 0 && targets.fat > 0);
});

test('missing profile values fall back to safe defaults', () => {
  const fallback = calculateNutritionTargets({}, today);
  assert.ok(fallback.kcal >= 1200);
  assert.equal(fallback.inputs.goal, 'maintain');
});

test('aggregates one day, ignores negative values, and deduplicates ids', () => {
  const entries = [
    { id: '1', createdAt: today.toISOString(), kcal: 500, protein: 30, carbs: 50, fat: 15 },
    { id: '1', createdAt: today.toISOString(), kcal: 500, protein: 30, carbs: 50, fat: 15 },
    { id: '2', createdAt: today.toISOString(), kcal: -20, protein: -2, carbs: 10, fat: 0 },
    { id: '3', createdAt: '2026-09-21T12:00:00Z', kcal: 900 }
  ];
  assert.deepEqual(aggregateDailyNutrition(entries, today), { kcal: 500, protein: 30, carbs: 60, fat: 15, sugar: 0, sodium: 0, meals: 2 });
});

test('calculates remaining and excess nutrition', () => {
  const state = calculateDailyNutritionState([{ id: '1', createdAt: today.toISOString(), kcal: targets.kcal + 100, protein: 10 }], targets, today);
  assert.equal(state.remaining.kcal, 0);
  assert.equal(state.over.kcal, 100);
  assert.equal(state.remaining.protein, targets.protein - 10);
});

test('handles zero intake and an extremely small remaining budget', () => {
  const zero = calculateDailyNutritionState([], targets, today);
  assert.equal(zero.remaining.kcal, targets.kcal);
  const tiny = calculateNextMealConstraints({ consumed: { meals: 3 }, remaining: { kcal: 80, protein: 5, carbs: 4, fat: 2 } }, {}, new Date('2026-09-22T19:00:00Z'));
  assert.deepEqual(tiny.kcal, { min: 0, max: 80 });
  assert.equal(tiny.mode, 'light');
});

test('recommendations exclude allergy conflicts', () => {
  const state = calculateDailyNutritionState([], targets, today);
  const result = recommendNextMeal(state, { allergies: 'soy, fish', dietaryPreference: 'vegetarian' }, [], today);
  assert.ok(result.meal);
  assert.equal(result.meal.allergens.some(item => ['soy', 'fish'].includes(item)), false);
});
