// ==========================================================================
// FITVAULT — Chart.js Analytics Subsystem
// ==========================================================================

import { state } from '../state.js';
import { getWorkoutTimestamp } from '../utils.js';   // shared util — no circular dep

let trendChartInstance   = null;
let workoutChartInstance = null;

// ── NUTRITION TREND CHART ─────────────────────────────────────────────────────

export function changeChartTimeframe(period = '7D') {
  ['tf-1d', 'tf-7d', 'tf-30d', 'tf-1y'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove('active');
  });
  const activeId = period === '1D' ? 'tf-1d'
    : period === '30D' ? 'tf-30d'
    : period === '1Y'  ? 'tf-1y'
    : 'tf-7d';
  const activeBtn = document.getElementById(activeId);
  if (activeBtn) activeBtn.classList.add('active');
  updateTrendChart(period);
}

export function updateTrendChart(period = '7D') {
  const canvas = document.getElementById('nutrition-trend-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const daysCount = period === '1D' ? 1 : period === '30D' ? 30 : period === '1Y' ? 365 : 7;
  const labels = [], pData = [], cData = [], fData = [], sData = [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    labels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

    const dayEntries = state.foodLog.filter(f => f.createdAt && new Date(f.createdAt).toDateString() === dateStr);
    pData.push(dayEntries.reduce((a, f) => a + (Number(f.protein) || 0), 0));
    cData.push(dayEntries.reduce((a, f) => a + (Number(f.carbs)   || 0), 0));
    fData.push(dayEntries.reduce((a, f) => a + (Number(f.fat)     || 0), 0));
    sData.push(dayEntries.reduce((a, f) => a + (Number(f.sugar)   || 0), 0));
  }

  if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Protein (g)', data: pData, borderColor: '#7ab5a0', backgroundColor: '#7ab5a022', tension: 0.3, fill: true },
        { label: 'Carbs (g)',   data: cData, borderColor: '#c9a96e', backgroundColor: '#c9a96e22', tension: 0.3, fill: true },
        { label: 'Fat (g)',     data: fData, borderColor: '#c47d6a', backgroundColor: '#c47d6a22', tension: 0.3, fill: true },
        { label: 'Sugar (g)',   data: sData, borderColor: '#a07ab5', backgroundColor: '#a07ab522', tension: 0.3, fill: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9c9488', font: { family: 'DM Sans' } } } },
      scales: {
        x: { ticks: { color: '#4a4741' }, grid: { color: '#2e2b26' } },
        y: { ticks: { color: '#4a4741' }, grid: { color: '#2e2b26' } }
      }
    }
  });
}

// ── WORKOUT FREQUENCY CHART ───────────────────────────────────────────────────

export function updateWorkoutChart(period = '7D') {
  const canvas = document.getElementById('workout-frequency-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const daysCount = period === '30D' ? 30 : 7;
  const labels = [], setsData = [];

  // Update filter buttons
  ['wf-7d', 'wf-30d'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove('active');
  });
  const activeBtnId = period === '30D' ? 'wf-30d' : 'wf-7d';
  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) activeBtn.classList.add('active');

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    labels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

    const dayWorkouts = state.workouts.filter(w => new Date(getWorkoutTimestamp(w)).toDateString() === dateStr);
    setsData.push(dayWorkouts.reduce((a, w) => a + (w.sets ? w.sets.length : 1), 0));
  }

  if (workoutChartInstance) { workoutChartInstance.destroy(); workoutChartInstance = null; }
  workoutChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Sets Logged', data: setsData, backgroundColor: '#f7f1e8', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9c9488', font: { family: 'DM Sans' } } } },
      scales: {
        x: { ticks: { color: '#4a4741' }, grid: { color: '#2e2b26' } },
        y: { ticks: { color: '#4a4741' }, grid: { color: '#2e2b26' }, beginAtZero: true }
      }
    }
  });
}

window.updateWorkoutChart   = updateWorkoutChart;
window.updateTrendChart     = updateTrendChart;
window.changeChartTimeframe = changeChartTimeframe;
