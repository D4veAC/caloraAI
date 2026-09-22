import { state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { syncAdaptiveDashboard } from './dashboard.js';

const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };

export function renderTrends() {
  const rolling = state.dashboard?.tomorrow?.rollingState;
  if (!rolling) return;
  setText('trend-calories', `${rolling.averageCalories.toLocaleString('id-ID')} kcal/day`);
  setText('trend-protein', `${rolling.averageProtein} g/day`);
  setText('trend-completeness', `${Math.round(rolling.loggingCompleteness * 100)}% · ${rolling.daysLogged}/${rolling.windowDays} days`);
  setText('trend-activity', `~${rolling.activityEnergyAverage} kcal/day`);
  setText('trend-weight', rolling.weightTrend == null ? 'Not enough measurements' : `${rolling.weightTrend > 0 ? '+' : ''}${rolling.weightTrend} kg/week`);
  setText('trend-confidence', rolling.confidence);
}

export async function saveWeightLog(event) {
  event.preventDefault();
  const input = document.getElementById('trend-weight-input');
  const response = await fetch('/api/weight', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ weightKg:Number(input.value), measuredAt:new Date().toISOString(), source:'MANUAL' }) });
  const payload = await response.json();
  if (!response.ok) return showToast(payload.error || 'Weight could not be saved', 'danger');
  input.value = '';
  await syncAdaptiveDashboard();
  renderTrends();
  showToast('Weight measurement saved', 'success');
}
