// ==========================================================================
// FITVAULT — Tab Router & Protected Route Guards
// ==========================================================================

import { state } from '../state.js';
import { updateNavIndicator } from './nav.js';
import { renderDashboardOverview } from '../features/dashboard.js';
import { updateWorkoutChart, updateTrendChart } from '../features/analytics.js';
import { syncRemoteFoodLogs } from '../features/nutrition.js';
import { initThreeJS, initDashCanvas } from '../features/scene3d.js';
import { renderTrends } from '../features/trends.js';

export function switchTab(name) {
  const protectedTabs = ['dashboard', 'training', 'nutrition', 'trends'];
  if (protectedTabs.includes(name) && !state.currentUser) {
    state.pendingTab = name;
    document.dispatchEvent(new CustomEvent('auth:required'));
    return;
  }
  _rawSwitchTab(name);
}

export function _rawSwitchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById(`tab-${name}`);
  const btn   = document.getElementById(`tab-${name}-btn`);
  if (panel) panel.classList.add('active');
  if (btn)   btn.classList.add('active');

  updateNavIndicator();

  if (name === 'welcome') {
    // Re-init Three.js so the canvas gets proper dimensions (panel was display:none on boot)
    setTimeout(() => {
      initDashCanvas();
      initThreeJS();
      window.dispatchEvent(new Event('resize'));
    }, 50);
  } else if (name === 'dashboard') {
    renderDashboardOverview();
  } else if (name === 'training') {
    setTimeout(() => updateWorkoutChart(), 100);
  } else if (name === 'nutrition') {
    syncRemoteFoodLogs();
    setTimeout(() => updateTrendChart(), 100);
  } else if (name === 'trends') {
    renderTrends();
  }
}
