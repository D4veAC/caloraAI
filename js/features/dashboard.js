// ==========================================================================
// FITVAULT — Dashboard Renderer
//
// Called by: router.js (on tab switch), main.js (on auth/data events), auth.js (after login)
//
// ELEMENT ID MAP (index.html #tab-dashboard):
//   Greeting row:         #dash-date-str, #dash-greeting
//   Calorie hero card:    #dash-kcal-consumed, #dash-kcal-fill, #dash-kcal-pct,
//                         #dash-kcal-target, #dash-rating-badge
//   Macro progress bars:  #dash-p-val/#dash-p-fill, #dash-c-val/#dash-c-fill,
//                         #dash-f-val/#dash-f-fill, #dash-s-val/#dash-s-fill
//   Training hero card:   #dash-wk-sessions, #dash-wk-sets, #dash-wk-duration,
//                         #dash-wk-exercises, #dash-last-session-label
//   Stat tiles:           #dash-tile-last-session, #dash-tile-last-session-sub,
//                         #dash-tile-sets, #dash-tile-meals, #dash-tile-meals-sub,
//                         #dash-tile-remaining
//   Preview lists:        #dash-food-preview, #dash-workout-preview
//
// IMPORTANT: All element IDs above must exist in index.html or their update is silently skipped.
// ==========================================================================

import { state } from '../state.js';
import { esc, calcNutriGrade, getWorkoutTimestamp } from '../utils.js';
import { calculateDailyNutritionState, calculateNutritionTargets } from '../domain/nutrition.mjs';

export async function syncAdaptiveDashboard() {
  if (!state.currentUser) return;
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) return;
    state.setDashboard(await response.json());
  } catch (error) {
    console.warn('[CALORA] Dashboard sync skipped:', error.message);
  }
}

// ── MAIN RENDER FUNCTION ──────────────────────────────────────────────────────
// Safe to call at any time — all DOM lookups are guarded with null checks.
export function renderDashboardOverview() {
  // ── GREETING ROW ──────────────────────────────────────────────────────────
  const greetingEl = document.getElementById('dash-greeting');
  if (greetingEl) greetingEl.textContent = state.currentUser || 'Calora user';

  const dateEl = document.getElementById('dash-date-str');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  // ── FOOD TOTALS (today only) ────────────────────────────────────────────────
  const todayStr = new Date().toDateString();
  // Include entries with no createdAt (legacy data) OR entries timestamped today
  const todayFood = state.foodLog.filter(
    f => !f.createdAt || new Date(f.createdAt).toDateString() === todayStr
  );
  const targets = calculateNutritionTargets(state.bodyStats);
  const daily = calculateDailyNutritionState(state.foodLog, targets);
  const food = daily.consumed;

  // ── CALORIE HERO CARD ──────────────────────────────────────────────────────
  const pct = Math.min(100, Math.round((food.kcal / targets.kcal) * 100));

  const kcalEl = document.getElementById('dash-kcal-consumed');
  const fillEl = document.getElementById('dash-kcal-fill');
  const pctEl  = document.getElementById('dash-kcal-pct');
  const tgtEl  = document.getElementById('dash-kcal-target');
  if (kcalEl) kcalEl.textContent = food.kcal.toLocaleString('id-ID');
  if (pctEl)  pctEl.textContent  = `${pct}%`;
  if (tgtEl)  tgtEl.textContent  = `of ${targets.kcal.toLocaleString('id-ID')} kcal target`;
  // Animate the bar width after a tick so CSS transition fires
  if (fillEl) setTimeout(() => { fillEl.style.width = `${pct}%`; }, 50);

  const gradeInfo = calcNutriGrade(food.kcal, targets.kcal, food.protein, targets.protein);
  const badgeEl   = document.getElementById('dash-rating-badge');
  if (badgeEl) {
    badgeEl.textContent = `Grade ${gradeInfo.grade}`;
    badgeEl.className   = `rating-badge ${gradeInfo.cls}`;
  }

  // ── MACRO PROGRESS BARS ────────────────────────────────────────────────────
  // Each macro: value element + fill bar element, capped at 100%
  const macroTargets = { p: targets.protein, c: targets.carbs, f: targets.fat, s: targets.sugar };
  [
    { key: 'p', val: food.protein, valId: 'dash-p-val', fillId: 'dash-p-fill' },
    { key: 'c', val: food.carbs,   valId: 'dash-c-val', fillId: 'dash-c-fill' },
    { key: 'f', val: food.fat,     valId: 'dash-f-val', fillId: 'dash-f-fill' },
    { key: 's', val: food.sugar,   valId: 'dash-s-val', fillId: 'dash-s-fill' },
  ].forEach(({ key, val, valId, fillId }) => {
    const valEl  = document.getElementById(valId);
    const fillEl = document.getElementById(fillId);
    if (valEl)  valEl.textContent  = `${Math.round(val)} / ${macroTargets[key]}g`;
    if (fillEl) setTimeout(() => {
      fillEl.style.width = `${Math.min(100, Math.round((val / macroTargets[key]) * 100))}%`;
    }, 80);
  });

  // ── TRAINING THIS WEEK ─────────────────────────────────────────────────────
  // Use getWorkoutTimestamp() to handle both ISO createdAt and short "5 Aug" date strings
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekWorkouts = (state.workouts || []).filter(w => getWorkoutTimestamp(w) >= weekAgo);

  const sessionDates   = new Set(weekWorkouts.map(w => w.date || 'unknown'));
  const totalSets      = weekWorkouts.reduce((a, w) => a + (w.sets ? w.sets.length : 1), 0);
  const totalExercises = weekWorkouts.length;
  const totalMinutes   = weekWorkouts.reduce((a, w) => a + (Number(w.duration) || 0), 0);

  const wkSessionsEl  = document.getElementById('dash-wk-sessions');
  const wkSetsEl      = document.getElementById('dash-wk-sets');
  const wkDurationEl  = document.getElementById('dash-wk-duration');
  const wkExercisesEl = document.getElementById('dash-wk-exercises');
  const lastLabelEl   = document.getElementById('dash-last-session-label');

  if (wkSessionsEl)  wkSessionsEl.textContent  = sessionDates.size;
  if (wkSetsEl)      wkSetsEl.textContent       = totalSets;
  if (wkDurationEl)  wkDurationEl.textContent   = totalMinutes > 0 ? `${totalMinutes}m` : '—';
  if (wkExercisesEl) wkExercisesEl.textContent  = totalExercises;
  if (lastLabelEl) {
    if (weekWorkouts.length > 0) {
      const last = weekWorkouts[weekWorkouts.length - 1];
      lastLabelEl.textContent = `Last: ${last.name || 'Session'} · ${last.date || ''}`;
    } else {
      lastLabelEl.textContent = 'No sessions this week';
    }
  }

  // ── STAT TILES ─────────────────────────────────────────────────────────────
  const lastSessionEl  = document.getElementById('dash-tile-last-session');
  const lastSessionSub = document.getElementById('dash-tile-last-session-sub');
  if (state.workouts && state.workouts.length > 0) {
    const last = state.workouts[state.workouts.length - 1];
    if (lastSessionEl)  lastSessionEl.textContent  = last.name || '—';
    if (lastSessionSub) lastSessionSub.textContent = last.date || 'Recent';
  }

  const setsEl = document.getElementById('dash-tile-sets');
  if (setsEl) setsEl.textContent = totalSets;

  const mealsEl  = document.getElementById('dash-tile-meals');
  const mealsSub = document.getElementById('dash-tile-meals-sub');
  if (mealsEl)  mealsEl.textContent  = todayFood.length;
  if (mealsSub) mealsSub.textContent = todayFood.length === 1 ? 'entry logged' : 'entries logged';

  const remainEl = document.getElementById('dash-tile-remaining');
  if (remainEl) remainEl.textContent = daily.remaining.kcal.toLocaleString('id-ID');

  // ── TOMORROW'S CATERING (server-owned rolling 7-day decision) ─────────────
  const plan = state.dashboard?.tomorrow;
  const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
  if (plan) {
    setText('catering-daily-target', `${Number(plan.effectiveDailyTarget).toLocaleString('id-ID')} kcal`);
    setText('catering-allocation', `${Number(plan.cateringAllocation).toLocaleString('id-ID')} kcal`);
    setText('catering-lunch', plan.lunch?.name || 'Menu unavailable');
    setText('catering-lunch-macros', plan.lunch ? `${plan.lunch.calories} kcal · ${plan.lunch.proteinG}g protein` : 'Check dietary constraints');
    const tonight = state.dashboard?.tonight;
    setText('catering-tonight', tonight?.meal?.name || 'Log food to get a tonight recommendation');
    setText('catering-tonight-macros', tonight?.meal
      ? `${tonight.meal.kcal} kcal · ${tonight.meal.protein}g protein · remaining ${tonight.constraints?.kcal?.max ?? 0} kcal`
      : tonight?.constraints ? `Remaining ${tonight.constraints.kcal?.max || 0} kcal tonight` : '');
    const goal = state.dashboard?.goalSummary;
    setText('dash-goal-label', goal?.label || 'Set a weight target');
    setText('dash-goal-target', goal ? `${goal.currentKg} kg → ${goal.targetKg} kg` : '');
    setText('catering-confidence', `${plan.confidence.toLowerCase()} confidence · ${plan.status.toLowerCase()}`);
    setText('catering-adjustment', plan.adaptations?.length ? plan.adaptations.join(' · ').replaceAll('_', ' ') : 'Calories unchanged');
    const explanations = document.getElementById('catering-explanations');
    if (explanations) explanations.innerHTML = (plan.explanations || []).map(item =>
      `<p class="dash-insight"><strong>${esc(item.code.replaceAll('_', ' '))}</strong><br>${esc(item.message)}</p>`
    ).join('') || '<p class="dash-insight">No adjustment is required.</p>';
  }

  // ── TODAY'S MEALS PREVIEW (last 4) ─────────────────────────────────────────
  const foodPreviewEl = document.getElementById('dash-food-preview');
  if (foodPreviewEl) {
    if (todayFood.length === 0) {
      foodPreviewEl.innerHTML = `<p class="dash-empty-meals">No meals logged today.</p>`;
    } else {
      foodPreviewEl.innerHTML = todayFood.slice().reverse().slice(0, 4).map(f => `
        <div class="dash-food-row">
          <div>
            <p class="dash-food-name" style="display:flex; align-items:center;">
              ${esc(f.meal || f.mealName || 'Meal')}
              ${f.grade ? `<span class="rating-badge rating-${f.grade.toLowerCase()}" style="font-size:10px; padding:1px 5px; margin-left:6px; line-height:1;">${f.grade}</span>` : ''}
            </p>
            <p class="dash-food-meta">P${f.protein}g · C${f.carbs}g · F${f.fat}g</p>
          </div>
          <span class="dash-food-kcal">${f.kcal} kcal</span>
        </div>
      `).join('');
    }
  }

  // ── RECENT WORKOUTS PREVIEW (last 4, newest first) ─────────────────────────
  const wkPreviewEl = document.getElementById('dash-workout-preview');
  if (wkPreviewEl) {
    const recent = (state.workouts || []).slice().reverse().slice(0, 4);
    if (recent.length === 0) {
      wkPreviewEl.innerHTML = `<p class="dash-empty-meals">No workouts logged yet.</p>`;
    } else {
      wkPreviewEl.innerHTML = recent.map(w => `
        <div class="dash-workout-row">
          <div>
            <p class="dash-workout-name">${esc(w.name || 'Exercise')}</p>
            <p class="dash-workout-meta">${esc(w.date || '')}${w.weight ? ` · ${w.weight}kg` : ''}</p>
          </div>
          <span class="dash-workout-sets">${w.sets ? w.sets.length + ' sets' : (w.reps ? w.reps + ' reps' : '—')}</span>
        </div>
      `).join('');
    }
  }
}
