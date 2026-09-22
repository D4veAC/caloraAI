// ==========================================================================
// FITVAULT — Application Entry Point & Bootstrap Coordinator
// ==========================================================================

import { state } from './state.js';
import { switchTab, _rawSwitchTab } from './ui/router.js';
import { initModalListeners, openModal, openFoodModal, closeFoodModal, openBodyStatsModal, closeBodyStatsModal, recalcAKGPreview } from './ui/modal.js';
import { updateNavIndicator, updateNavUserDisplay } from './ui/nav.js';
import { checkAuth, submitUsername, loginGoBack, submitPassword, lockApp, closeLoginOverlay, openLoginOverlay } from './features/auth.js';
import { renderDashboardOverview, syncAdaptiveDashboard } from './features/dashboard.js';
import { renderWorkouts, syncTimers, setWorkoutLogFilter, syncWebhookWorkouts } from './features/workout.js';
import { renderFoodLog, syncRemoteFoodLogs } from './features/nutrition.js';
import { updateTrendChart, updateWorkoutChart, changeChartTimeframe } from './features/analytics.js';
import { initDashCanvas, initThreeJS } from './features/scene3d.js';
import { renderTrends, saveWeightLog } from './features/trends.js';
import { connectTelegram, copyTelegramCommand, loadTelegramStatus } from './features/integrations.js';

// ── Global handlers for HTML inline onclick attributes ────────────────────────
window.switchTab            = switchTab;
window._rawSwitchTab        = _rawSwitchTab;
window.openDashboardWithAuth = () => switchTab('dashboard');
window.openModal            = openModal;
window.openFoodModal        = openFoodModal;
window.closeFoodModal       = closeFoodModal;
window.openBodyStatsModal   = openBodyStatsModal;
window.closeBodyStatsModal  = closeBodyStatsModal;
window.recalcAKGPreview     = recalcAKGPreview;
window.submitUsername       = submitUsername;
window.loginGoBack          = loginGoBack;
window.submitPassword       = submitPassword;
window.lockApp              = lockApp;
window.closeLoginOverlay    = closeLoginOverlay;
window.setWorkoutLogFilter  = setWorkoutLogFilter;
window.changeChartTimeframe = changeChartTimeframe;
window.updateWorkoutChart   = updateWorkoutChart;
window.saveWeightLog        = saveWeightLog;
window.connectTelegram      = connectTelegram;
window.copyTelegramCommand  = copyTelegramCommand;

// ── Bootstrap ─────────────────────────────────────────────────────────────────
if (!window.__FITVAULT_BOOTSTRAPPED__) {
  window.__FITVAULT_BOOTSTRAPPED__ = true;

  async function bootApp() {
    // 1. UI scaffolding
    initModalListeners();
    updateNavUserDisplay();

    // 2. Auth check — always redirects to welcome (currentUser is null on boot)
    await checkAuth();
    window.addEventListener('focus', loadTelegramStatus);

    // 3. Data rendering (renders to hidden DOM, no tab switch)
    renderWorkouts();
    syncTimers();
    renderFoodLog();
    if (state.currentUser) syncWebhookWorkouts();

    // 4. Load the authenticated user's server-owned food log.
    if (state.currentUser) syncRemoteFoodLogs();

    updateNavIndicator();

    // 5. Charts render after a short delay (canvases need to be visible first)
    setTimeout(() => {
      updateTrendChart();
      updateWorkoutChart();
    }, 500);

    // Remove loading screen
    const ldr = document.getElementById('loading-screen');
    if (ldr) {
      ldr.style.opacity = '0';
      setTimeout(() => ldr.remove(), 400);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    state.subscribe((event) => {
      if (event === 'auth_changed') {
        updateNavUserDisplay();
        renderDashboardOverview();
      } else if (event === 'workouts_changed') {
        renderWorkouts();
        updateWorkoutChart();
        renderDashboardOverview();
      } else if (event === 'nutrition_changed' || event === 'food_changed' || event === 'bodystats_changed') {
        renderFoodLog();
        updateTrendChart();
        renderDashboardOverview();
        syncAdaptiveDashboard();
      } else if (event === 'dashboard_changed') {
        renderFoodLog();
        renderWorkouts();
        renderDashboardOverview();
        renderTrends();
      }
    });

    document.addEventListener('auth:required', openLoginOverlay);

    bootApp();
    loadTelegramStatus();
  });
}
