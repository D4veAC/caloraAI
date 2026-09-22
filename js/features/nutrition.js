import { state } from '../state.js';
import { esc, calcNutriGrade } from '../utils.js';
import { calculateDailyNutritionState, calculateNutritionTargets } from '../domain/nutrition.mjs';
import { showToast } from '../ui/toast.js';
import { closeFoodModal, showConfirmModal } from '../ui/modal.js';
import { updateTrendChart } from './analytics.js';
import { renderDashboardOverview } from './dashboard.js';

let selectedDate = new Date();

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function updateSummary(targets, daily) {
  setText('total-kcal-display', Math.round(daily.consumed.kcal).toLocaleString('id-ID'));
  setText('target-akg-kcal', targets.kcal.toLocaleString('id-ID'));
  setText('total-protein', Math.round(daily.consumed.protein));
  setText('total-carbs', Math.round(daily.consumed.carbs));
  setText('total-fat', Math.round(daily.consumed.fat));
  setText('total-sugar', Math.round(daily.consumed.sugar));
  setText('total-sodium', Math.round(daily.consumed.sodium));
  setText('target-akg-p', targets.protein);
  setText('target-akg-c', targets.carbs);
  setText('target-akg-f', targets.fat);
  setText('sidebar-bb', targets.inputs.weightKg);
  setText('sidebar-tb', targets.inputs.heightCm);
  setText('sidebar-bmr', targets.bmr.toLocaleString('id-ID'));
  setText('sidebar-tdee', targets.kcal.toLocaleString('id-ID'));

  const grade = calcNutriGrade(daily.consumed.kcal, targets.kcal, daily.consumed.protein, targets.protein);
  const badge = document.getElementById('sidebar-rating-badge');
  if (badge) {
    badge.textContent = `Grade ${grade.grade}`;
    badge.className = `rating-badge ${grade.cls}`;
  }

  const macroCalories = daily.consumed.protein * 4 + daily.consumed.carbs * 4 + daily.consumed.fat * 9 || 1;
  const widths = {
    'total-p-bar': daily.consumed.protein * 4 / macroCalories,
    'total-c-bar': daily.consumed.carbs * 4 / macroCalories,
    'total-f-bar': daily.consumed.fat * 9 / macroCalories
  };
  Object.entries(widths).forEach(([id, ratio]) => {
    const bar = document.getElementById(id);
    if (bar) bar.style.width = `${Math.round(ratio * 100)}%`;
  });
}

export function renderFoodLog() {
  const dateInput = document.getElementById('food-date-filter');
  if (dateInput) dateInput.value = [selectedDate.getFullYear(), String(selectedDate.getMonth() + 1).padStart(2, '0'), String(selectedDate.getDate()).padStart(2, '0')].join('-');

  const targets = calculateNutritionTargets(state.bodyStats);
  const daily = calculateDailyNutritionState(state.foodLog, targets, selectedDate);
  const entries = state.foodLog.filter(entry => entry.createdAt && new Date(entry.createdAt).toDateString() === selectedDate.toDateString());
  updateSummary(targets, daily);
  setText('food-entry-count', `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`);

  const container = document.getElementById('food-log-list');
  if (!container) return;
  if (!entries.length) {
    container.innerHTML = '<div class="empty-food">No food entries for this date.</div>';
    return;
  }
  container.innerHTML = entries.slice().reverse().map(entry => `
    <article class="food-log-card">
      <div class="food-log-info">
        <div class="food-log-title">${esc(entry.meal || entry.mealName || 'Meal')}</div>
        <div class="food-log-macros">
          <span>${esc(entry.category || 'meal')}</span>
          <span>P ${entry.protein || 0}g</span><span>C ${entry.carbs || 0}g</span><span>F ${entry.fat || 0}g</span>
        </div>
        ${entry.source === 'ai-photo' ? `<small class="estimate-note">AI estimate${entry.confidence != null ? ` · ${Math.round(entry.confidence * 100)}% confidence` : ''}; reviewed before saving.</small>` : ''}
      </div>
      <div class="food-log-actions">
        <strong>${entry.kcal} kcal</strong>
        <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteFoodLogEntry('${esc(entry.id)}')">Delete</button>
      </div>
    </article>`).join('');
}

export function deleteFoodLogEntry(id) {
  showConfirmModal({
    title: 'Delete Food Entry',
    message: 'Remove this food entry permanently?',
    actionText: 'Delete',
    isDanger: true,
    onConfirm: async () => {
      try {
        const response = await fetch(`/api/food/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Food entry could not be deleted');
        state.deleteFoodLog(id);
        renderFoodLog();
        updateTrendChart();
        renderDashboardOverview();
        showToast('Food entry deleted', 'info');
      } catch (error) { showToast(error.message, 'danger'); }
    }
  });
}

export async function saveManualFoodLog(event) {
  event?.preventDefault();
  const button = document.getElementById('food-save-btn');
  const entry = {
    meal: document.getElementById('food-name-input')?.value.trim(),
    category: document.getElementById('food-category-input')?.value,
    kcal: Number(document.getElementById('food-kcal-input')?.value),
    protein: Number(document.getElementById('food-p-input')?.value || 0),
    carbs: Number(document.getElementById('food-c-input')?.value || 0),
    fat: Number(document.getElementById('food-f-input')?.value || 0),
    source: 'manual',
    createdAt: new Date().toISOString()
  };
  if (!entry.meal || !Number.isFinite(entry.kcal) || entry.kcal <= 0 || [entry.protein, entry.carbs, entry.fat].some(value => value < 0)) {
    return showToast('Enter a meal name and valid non-negative nutrition values', 'danger');
  }
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const response = await fetch('/api/food', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Food entry could not be saved');
    state.addFoodLog(payload);
    event.target.reset();
    closeFoodModal();
    renderFoodLog();
    updateTrendChart();
    renderDashboardOverview();
    showToast('Food entry logged', 'success');
  } catch (error) { showToast(error.message, 'danger'); }
  finally {
    button.disabled = false;
    button.textContent = 'Save Food';
  }
}

export async function syncRemoteFoodLogs() {
  if (!state.currentUser) return;
  try {
    const response = await fetch('/api/food');
    if (!response.ok) return;
    const entries = await response.json();
    if (Array.isArray(entries)) state.setFoodLog(entries);
  } catch (error) {
    console.warn('[CALORA] Food sync skipped:', error.message);
  }
  renderFoodLog();
  renderDashboardOverview();
}

if (!window.__FOOD_LOG_POLLING__) {
  window.__FOOD_LOG_POLLING__ = true;
  setInterval(() => { if (state.currentUser) syncRemoteFoodLogs(); }, 30_000);
}

export function handleFoodDateChange(value) {
  if (!value) selectedDate = new Date();
  else {
    const [year, month, day] = value.split('-').map(Number);
    selectedDate = new Date(year, month - 1, day);
  }
  renderFoodLog();
}

window.deleteFoodLogEntry = deleteFoodLogEntry;
window.saveManualFoodLog = saveManualFoodLog;
window.handleFoodDateChange = handleFoodDateChange;
