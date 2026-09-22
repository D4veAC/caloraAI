// ==========================================================================
// FITVAULT — Modal & Dialog Manager
// ==========================================================================

import { state } from '../state.js';
import { calculateNutritionTargets } from '../domain/nutrition.mjs';

let confirmCallback = null;

export function openModal() {
  const overlay = document.getElementById('log-overlay');
  if (overlay) overlay.classList.add('open');
}

export function closeModal() {
  const overlay = document.getElementById('log-overlay');
  if (overlay) overlay.classList.remove('open');
}

export function openFoodModal() {
  const overlay = document.getElementById('food-overlay');
  if (overlay) overlay.classList.add('open');
  setTimeout(() => document.getElementById('food-name-input')?.focus(), 100);
}

export function closeFoodModal() {
  document.getElementById('food-overlay')?.classList.remove('open');
}

export function recalcAKGPreview() {
  const bb = Number(document.getElementById('inp-bb')?.value || 65);
  const tb = Number(document.getElementById('inp-tb')?.value || 171);
  const age = Number(document.getElementById('inp-age')?.value || 25);
  const akg = calculateNutritionTargets({
    bb, tb, age,
    sex: document.getElementById('inp-sex')?.value,
    activity: document.getElementById('inp-activity')?.value,
    goal: document.getElementById('inp-goal')?.value,
    rateKgPerWeek: document.getElementById('inp-rate')?.value
  });

  const bmrEl = document.getElementById('akg-bmr-val');
  const tdeeEl = document.getElementById('akg-tdee-val');
  if (bmrEl) bmrEl.textContent = `${akg.bmr} kcal`;
  if (tdeeEl) tdeeEl.textContent = `${akg.kcal} kcal`;
  document.getElementById('akg-p-val').textContent = `${akg.protein}g`;
  document.getElementById('akg-c-val').textContent = `${akg.carbs}g`;
  document.getElementById('akg-f-val').textContent = `${akg.fat}g`;
}

export function openBodyStatsModal() {
  const bbInput = document.getElementById('inp-bb');
  const tbInput = document.getElementById('inp-tb');
  const ageInput = document.getElementById('inp-age');

  if (bbInput && state.bodyStats.bb) bbInput.value = state.bodyStats.bb;
  if (tbInput && state.bodyStats.tb) tbInput.value = state.bodyStats.tb;
  if (ageInput && state.bodyStats.age) ageInput.value = state.bodyStats.age;
  ['sex', 'activity', 'goal'].forEach(key => {
    const input = document.getElementById(`inp-${key}`);
    if (input && state.bodyStats[key]) input.value = state.bodyStats[key];
  });
  const fieldMap = { targetWeightKg: 'target-weight', rateKgPerWeek: 'rate', dietaryPreference: 'diet', allergies: 'allergies', dislikedFoods: 'dislikes' };
  Object.entries(fieldMap).forEach(([key, id]) => {
    const input = document.getElementById(`inp-${id}`);
    if (input && state.bodyStats[key] != null) input.value = state.bodyStats[key];
  });
  const targetWeightInput = document.getElementById('inp-target-weight');
  if (targetWeightInput && !targetWeightInput.value) targetWeightInput.value = state.bodyStats.bb || 65;

  recalcAKGPreview();

  const overlay = document.getElementById('bodystats-overlay');
  if (overlay) overlay.classList.add('open');
  import('../features/integrations.js').then(module => module.loadTelegramStatus());
}

export function closeBodyStatsModal() {
  const overlay = document.getElementById('bodystats-overlay');
  if (overlay) overlay.classList.remove('open');
}

export function showConfirmModal({ title = 'Confirm Action', message, actionText = 'Confirm', isDanger = false, onConfirm }) {
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const btn = document.getElementById('confirm-action-btn');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;

  if (btn) {
    btn.textContent = actionText;
    btn.className = `btn ${isDanger ? 'btn-danger' : 'btn-fill'}`;
  }

  confirmCallback = onConfirm;

  const overlay = document.getElementById('confirm-overlay');
  if (overlay) overlay.classList.add('open');
}

export function closeConfirmModal() {
  const overlay = document.getElementById('confirm-overlay');
  if (overlay) overlay.classList.remove('open');
}

export function initModalListeners() {
  const confirmBtn = document.getElementById('confirm-action-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirmModal();
    });
  }

  ['log-overlay', 'food-overlay', 'confirm-overlay', 'bodystats-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', e => {
        if (e.target === e.currentTarget) {
          if (id === 'log-overlay') closeModal();
          if (id === 'food-overlay') closeFoodModal();
          if (id === 'confirm-overlay') closeConfirmModal();
          if (id === 'bodystats-overlay') closeBodyStatsModal();
        }
      });
    }
  });
}
