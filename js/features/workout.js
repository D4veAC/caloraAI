// ==========================================================================
// FITVAULT — Workout Tracker & Live Session Timer Subsystem
// ==========================================================================

import { state } from '../state.js';
import { formatTime, esc, getWorkoutTimestamp } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { showConfirmModal, closeModal, closeBodyStatsModal } from '../ui/modal.js';
import { updateWorkoutChart } from './analytics.js';
import { renderDashboardOverview } from './dashboard.js';

let timerInterval = null;
let currentWorkoutFilter = 'ALL';

// ── TIMER ─────────────────────────────────────────────────────────────────────

export function toggleTimer() {
  const btn = document.getElementById('btn-timer-toggle');
  if (!state.timerRunning) {
    state.timerRunning = true;
    if (btn) btn.textContent = 'Pause';
    showToast('Session timer started', 'info');
    timerInterval = setInterval(() => {
      state.setTimerSec(state.timerSec + 1);
      updateTimerDisplay();
    }, 1000);
  } else {
    state.timerRunning = false;
    if (btn) btn.textContent = 'Resume';
    clearInterval(timerInterval);
    timerInterval = null;
    showToast('Session timer paused', 'info');
  }
}

export function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  if (display) display.textContent = formatTime(state.timerSec);
}

export function promptEndSession() {
  if (state.timerSec === 0) { showToast('No active timer to end', 'info'); return; }
  showConfirmModal({
    title: 'End Workout Session',
    message: `Save active session duration (${formatTime(state.timerSec)}) and finish?`,
    actionText: 'End & Save',
    onConfirm: endSession
  });
}

export async function endSession() {
  state.timerRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  const btn = document.getElementById('btn-timer-toggle');
  if (btn) btn.textContent = 'Start';
  const durationMin = Math.round(state.timerSec / 60);
  const response = await fetch('/api/activity', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ activityType:'WORKOUT', name:'Workout Session', startedAt:new Date().toISOString(), durationSeconds:state.timerSec, dataQuality:'USER_REPORTED' }) });
  if (!response.ok) return showToast('Workout session could not be saved', 'danger');
  state.setTimerSec(0);
  updateTimerDisplay();
  showToast(`Session completed (${durationMin} mins logged)`, 'success');
  await syncWebhookWorkouts();
  renderDashboardOverview();
}

export async function syncWebhookWorkouts() {
  try {
    const res = await fetch('/api/activity');
    if (!res.ok) return;
    const remoteWorkouts = await res.json();
    if (!Array.isArray(remoteWorkouts) || remoteWorkouts.length === 0) return;

    let updated = false;
    const currentIds = new Set((state.workouts || []).map(w => w.id));

    remoteWorkouts.forEach(rw => {
      if (!currentIds.has(rw.id)) {
        state.addWorkout(rw);
        updated = true;
      }
    });

    if (updated) {
      showToast('New workout synced from Health Connect', 'info');
    }
  } catch (e) {
    // API endpoint unavailable
  }
}

export function syncTimers() {
  updateTimerDisplay();
}

// ── WORKOUT LOG FILTER ────────────────────────────────────────────────────────

export function setWorkoutLogFilter(filter = 'ALL') {
  currentWorkoutFilter = filter;
  ['wlf-all', 'wlf-today', 'wlf-7d', 'wlf-30d'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove('active');
  });
  const activeId = filter === 'TODAY' ? 'wlf-today'
    : filter === '7D'    ? 'wlf-7d'
    : filter === '30D'   ? 'wlf-30d'
    : 'wlf-all';
  const activeBtn = document.getElementById(activeId);
  if (activeBtn) activeBtn.classList.add('active');
  renderWorkouts();
}

// ── RENDER WORKOUT LOG ────────────────────────────────────────────────────────

export function renderWorkouts() {
  const container = document.getElementById('workout-log') || document.getElementById('workout-list');
  if (!container) return;

  const todayStr = new Date().toDateString();
  const weekAgo  = Date.now() - 7  * 24 * 60 * 60 * 1000;
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const filtered = (state.workouts || []).filter(w => {
    const t = getWorkoutTimestamp(w);
    if (currentWorkoutFilter === 'TODAY') return new Date(t).toDateString() === todayStr;
    if (currentWorkoutFilter === '7D')    return t >= weekAgo;
    if (currentWorkoutFilter === '30D')   return t >= monthAgo;
    return true;
  });

  // Sidebar summary
  const totalExercises = filtered.length;
  const totalSets      = filtered.reduce((a, w) => a + (w.sets ? w.sets.length : 1), 0);
  const totalVolume    = filtered.reduce((a, w) => {
    if (w.sets && w.sets.length > 0)
      return a + w.sets.reduce((sa, s) => sa + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
    return a + (Number(w.weight) || 0) * (Number(w.reps) || 0);
  }, 0);

  const sumEx  = document.getElementById('sum-exercises');
  const sumSet = document.getElementById('sum-sets');
  const sumVol = document.getElementById('sum-volume');
  if (sumEx)  sumEx.textContent  = totalExercises;
  if (sumSet) sumSet.textContent = totalSets;
  if (sumVol) sumVol.textContent = `${totalVolume.toLocaleString('id-ID')} kg`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="trend-chart-card" style="text-align:center;padding:32px;color:var(--ink-muted);">
        No workout entries found. Click "+ Add Exercise" to log a set.
      </div>`;
    return;
  }

  container.innerHTML = filtered.slice().reverse().map(w => `
    <div class="exercise-card">
      <div class="exercise-header">
        <div>
          <h3 class="exercise-title">${esc(w.name)}</h3>
          <span style="font-size:12px;color:var(--ink-muted);">${esc(w.date || 'Today')}</span>
        </div>
        <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteExerciseEntry('${w.id}')">Delete</button>
      </div>
      ${w.sets && w.sets.length > 0 ? `
        <table class="set-table">
          <thead><tr><th>Set</th><th>Weight (kg)</th><th>Reps</th></tr></thead>
          <tbody>
            ${w.sets.map((s, idx) => `
              <tr><td>${idx + 1}</td><td>${s.weight}</td><td>${s.reps}</td></tr>
            `).join('')}
          </tbody>
        </table>
      ` : (() => {
          const wt = typeof w.weight === 'number' ? w.weight : (Array.isArray(w.weight) && w.weight[0] ? (w.weight[0].kilograms || w.weight[0].weight) : (typeof w.weight === 'object' && w.weight !== null ? (w.weight.kilograms || w.weight.weight) : w.weight));
          const parts = [];
          if (wt) parts.push(`${wt} kg`);
          if (w.reps) parts.push(`${w.reps} reps`);
          if (w.duration) parts.push(`${w.duration} mins`);
          if (w.calories) parts.push(`${w.calories} kcal`);
          if (w.heartRate) parts.push(`HR: ${w.heartRate} bpm`);
          if (w.cadence) parts.push(`Cadence: ${w.cadence}`);
          if (w.distance) parts.push(`${w.distance} km`);
          return `<p style="font-size:13px;color:var(--ink-muted);">${parts.join(' · ')}</p>`;
        })()}
    </div>
  `).join('');
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function deleteExerciseEntry(id) {
  showConfirmModal({
    title: 'Delete Exercise Entry',
    message: 'Are you sure you want to delete this workout log? This cannot be undone.',
    actionText: 'Delete Entry',
    isDanger: true,
    onConfirm: async () => {
      const entry = state.workouts.find(workout => workout.id === id);
      if (entry?.source || entry?.provider) {
        const response = await fetch(`/api/activity/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!response.ok) return showToast('Workout could not be deleted', 'danger');
      }
      state.deleteWorkout(id);
      renderWorkouts();
      updateWorkoutChart();
      renderDashboardOverview();
      showToast('Exercise entry deleted', 'info');
    }
  });
}

export async function handleLogSubmit(e) {
  if (e) e.preventDefault();
  const nameInput   = document.getElementById('inp-exercise');
  const weightInput = document.getElementById('inp-weight');
  const repsInput   = document.getElementById('inp-reps');

  const name   = nameInput   ? nameInput.value.trim()    : '';
  const weight = weightInput ? Number(weightInput.value) : 0;
  const reps   = repsInput   ? Number(repsInput.value)   : 0;
  if (!name) return;

  const now = new Date();
  const response = await fetch('/api/activity', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ activityType:'STRENGTH', name:`${name} · ${weight}kg × ${reps}`, startedAt:now.toISOString(), dataQuality:'USER_REPORTED' }) });
  if (!response.ok) return showToast('Exercise entry could not be saved', 'danger');

  if (nameInput)   nameInput.value   = '';
  if (weightInput) weightInput.value = '';
  if (repsInput)   repsInput.value   = '';

  closeModal();
  await syncWebhookWorkouts();
  renderWorkouts();
  updateWorkoutChart();
  renderDashboardOverview();
  showToast('Exercise entry logged', 'success');
}

export async function handleBodyStatsSubmit(e) {
  if (e) e.preventDefault();
  const profile = {
    bb: Number(document.getElementById('inp-bb')?.value),
    tb: Number(document.getElementById('inp-tb')?.value),
    age: Number(document.getElementById('inp-age')?.value),
    sex: document.getElementById('inp-sex')?.value,
    activity: document.getElementById('inp-activity')?.value,
    goal: document.getElementById('inp-goal')?.value,
    targetWeightKg: Number(document.getElementById('inp-target-weight')?.value),
    rateKgPerWeek: Number(document.getElementById('inp-rate')?.value),
    dietaryPreference: document.getElementById('inp-diet')?.value,
    allergies: document.getElementById('inp-allergies')?.value,
    dislikedFoods: document.getElementById('inp-dislikes')?.value
  };
  const button = document.getElementById('profile-save-btn');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Profile could not be saved');
    state.setBodyStats(payload);
    closeBodyStatsModal();
    renderDashboardOverview();
    showToast('Nutrition profile updated', 'success');
  } catch (error) { showToast(error.message, 'danger'); }
  finally {
    button.disabled = false;
    button.textContent = 'Save Profile';
  }
}

// Global handlers for inline HTML attributes
window.toggleTimer           = toggleTimer;
window.promptEndSession      = promptEndSession;
window.deleteExerciseEntry   = deleteExerciseEntry;
window.handleLogSubmit       = handleLogSubmit;
window.handleBodyStatsSubmit = handleBodyStatsSubmit;
window.setWorkoutLogFilter   = setWorkoutLogFilter;
