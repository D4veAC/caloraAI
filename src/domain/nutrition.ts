export const NUTRITION_FORMULA_VERSION = 'mifflin-st-jeor-v1';

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725
};

const MEAL_TEMPLATES = [
  { name: 'Ayam panggang, nasi, dan sayur', kcal: 510, protein: 42, carbs: 52, fat: 14, tags: ['omnivore'], allergens: [] },
  { name: 'Ikan panggang dan tumis sayur', kcal: 430, protein: 40, carbs: 28, fat: 16, tags: ['pescatarian'], allergens: ['fish'] },
  { name: 'Tempe, nasi merah, dan sayur', kcal: 480, protein: 30, carbs: 58, fat: 15, tags: ['vegetarian', 'vegan'], allergens: ['soy'] },
  { name: 'Telur, kentang, dan salad', kcal: 390, protein: 27, carbs: 35, fat: 16, tags: ['vegetarian'], allergens: ['egg'] },
  { name: 'Yogurt tinggi protein dan buah', kcal: 260, protein: 24, carbs: 32, fat: 5, tags: ['vegetarian', 'snack'], allergens: ['dairy'] }
];

const numberInRange = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const cleanList = value => String(value || '')
  .split(',')
  .map(item => item.trim().toLowerCase())
  .filter(Boolean);

export function normalizeNutritionProfile(profile: any = {}) {
  const goal = ['lose', 'maintain', 'gain'].includes(profile.goal) ? profile.goal : 'maintain';
  const sex = profile.sex === 'female' ? 'female' : 'male';
  const activity = ACTIVITY_FACTORS[profile.activity] ? profile.activity : 'moderate';
  return {
    age: numberInRange(profile.age, 25, 18, 100),
    weightKg: numberInRange(profile.weightKg ?? profile.bb, 65, 30, 350),
    heightCm: numberInRange(profile.heightCm ?? profile.tb, 171, 120, 230),
    sex,
    activity,
    goal,
    targetWeightKg: numberInRange(profile.targetWeightKg ?? profile.targetWeight, profile.weightKg ?? profile.bb ?? 65, 30, 350),
    rateKgPerWeek: goal === 'maintain' ? 0 : numberInRange(profile.rateKgPerWeek, 0.25, 0.1, 1),
    dietaryPreference: String(profile.dietaryPreference || 'none').toLowerCase(),
    allergies: cleanList(profile.allergies),
    dislikedFoods: cleanList(profile.dislikedFoods)
  };
}

export function calculateNutritionTargets(profile: any = {}, now = new Date()) {
  const inputs = normalizeNutritionProfile(profile);
  const sexAdjustment = inputs.sex === 'female' ? -161 : 5;
  const bmr = Math.round(10 * inputs.weightKg + 6.25 * inputs.heightCm - 5 * inputs.age + sexAdjustment);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[inputs.activity]);
  const weeklyAdjustment = Math.round((inputs.rateKgPerWeek * 7700) / 7);
  const goalAdjustment = inputs.goal === 'lose' ? -weeklyAdjustment : inputs.goal === 'gain' ? weeklyAdjustment : 0;
  const calorieFloor = inputs.sex === 'female' ? 1200 : 1500;
  const kcal = Math.max(calorieFloor, tdee + goalAdjustment);
  const proteinMultiplier = inputs.goal === 'lose' ? 1.8 : inputs.goal === 'gain' ? 1.7 : 1.6;
  const protein = Math.round(inputs.weightKg * proteinMultiplier);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return {
    version: NUTRITION_FORMULA_VERSION,
    calculatedAt: now.toISOString(),
    inputs,
    bmr,
    tdee,
    kcal,
    protein,
    carbs,
    fat,
    sugar: 30,
    sodium: 2000
  };
}

function nutrient(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function aggregateDailyNutrition(entries: any[] = [], date = new Date()) {
  const day = new Date(date).toDateString();
  const seen = new Set();
  return entries.reduce((total, entry) => {
    const id = String(entry.id || entry.createdAt || '');
    if ((id && seen.has(id)) || (entry.createdAt && new Date(entry.createdAt).toDateString() !== day)) return total;
    if (id) seen.add(id);
    total.kcal += nutrient(entry.kcal);
    total.protein += nutrient(entry.protein);
    total.carbs += nutrient(entry.carbs);
    total.fat += nutrient(entry.fat);
    total.sugar += nutrient(entry.sugar);
    total.sodium += nutrient(entry.sodium);
    total.meals += 1;
    return total;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0, meals: 0 });
}

export function calculateDailyNutritionState(entries: any[] = [], targets: any, date = new Date()) {
  const consumed = aggregateDailyNutrition(entries, date);
  const remaining = {};
  const over = {};
  for (const key of ['kcal', 'protein', 'carbs', 'fat']) {
    const difference = nutrient(targets?.[key]) - consumed[key];
    remaining[key] = Math.max(0, Math.round(difference));
    over[key] = Math.max(0, Math.round(-difference));
  }
  return { targets, consumed, remaining, over, date: new Date(date).toISOString().slice(0, 10) };
}

function recommendedMealShare(hour, mealsLogged) {
  if (hour >= 18 || mealsLogged >= 3) return 0.9;
  if (hour >= 13 || mealsLogged >= 2) return 0.55;
  return 0.4;
}

export function calculateNextMealConstraints(state: any, profile: any = {}, now = new Date()) {
  const remaining = state?.remaining || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const share = recommendedMealShare(now.getHours(), state?.consumed?.meals || 0);
  const range = (value, minimum = 0, cap = Infinity) => {
    const upper = Math.min(value, cap, Math.max(minimum, Math.round(value * share)));
    return { min: Math.max(0, Math.round(upper * 0.65)), max: Math.max(0, upper) };
  };
  const kcal = remaining.kcal < 120 ? { min: 0, max: remaining.kcal } : range(remaining.kcal, 120, 750);
  return {
    meal: now.getHours() >= 17 ? 'Dinner' : now.getHours() >= 11 ? 'Lunch / next meal' : 'Breakfast / next meal',
    kcal,
    protein: range(remaining.protein, 0, 50),
    carbs: range(remaining.carbs, 0, 70),
    fat: range(remaining.fat, 0, 25),
    mode: remaining.kcal < 120 ? 'light' : 'normal',
    excludedIngredients: normalizeNutritionProfile(profile).allergies
  };
}

function conflictsWithProfile(meal, profile) {
  const normalized = normalizeNutritionProfile(profile);
  const blocked = new Set([...normalized.allergies, ...normalized.dislikedFoods]);
  if (meal.allergens.some(item => blocked.has(item))) return true;
  if (normalized.dietaryPreference === 'vegan' && !meal.tags.includes('vegan')) return true;
  if (normalized.dietaryPreference === 'vegetarian' && !meal.tags.some(tag => tag === 'vegetarian' || tag === 'vegan')) return true;
  if (normalized.dietaryPreference === 'pescatarian' && meal.tags.includes('omnivore')) return true;
  return false;
}

export function recommendNextMeal(state: any, profile: any = {}, recentMeals: any[] = [], now = new Date()) {
  const constraints = calculateNextMealConstraints(state, profile, now);
  const recentNames = new Set(recentMeals.slice(-4).map(item => String(item.meal || item.mealName || '').toLowerCase()));
  const candidates = MEAL_TEMPLATES
    .filter(meal => !conflictsWithProfile(meal, profile))
    .map(meal => {
      const kcalGap = Math.abs(meal.kcal - constraints.kcal.max) / Math.max(1, constraints.kcal.max);
      const proteinGap = Math.abs(meal.protein - constraints.protein.max) / Math.max(1, constraints.protein.max);
      const nutritionScore = Math.max(0, Math.round(100 - (kcalGap * 55 + proteinGap * 45) * 100));
      const varietyScore = recentNames.has(meal.name.toLowerCase()) ? 0 : 10;
      return { ...meal, nutritionScore, varietyScore, score: nutritionScore + varietyScore };
    })
    .sort((a, b) => b.score - a.score);
  return { constraints, meal: candidates[0] || null };
}

export function buildAdaptiveInsight(state) {
  const { consumed, targets, remaining, over } = state;
  if (!consumed.meals) return 'Log your first meal to receive an adaptive next-meal plan.';
  if (over.kcal) return `You are ${over.kcal} kcal above today’s target. Prioritize hydration and a lighter next meal.`;
  const calorieRatio = consumed.kcal / Math.max(1, targets.kcal);
  const carbRatio = consumed.carbs / Math.max(1, targets.carbs);
  const proteinRatio = consumed.protein / Math.max(1, targets.protein);
  if (carbRatio > calorieRatio + 0.15) return 'Carbohydrates are ahead of pace. The next meal should prioritize lean protein and vegetables.';
  if (proteinRatio + 0.15 < calorieRatio) return `Protein is behind pace. Aim for ${remaining.protein} g more today.`;
  return 'Your intake is balanced so far. Keep the next meal close to the recommended range.';
}
