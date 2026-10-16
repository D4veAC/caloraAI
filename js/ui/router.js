import { state } from '../state.js';
import { updateNavIndicator } from './nav.js';
import { renderDashboardOverview } from '../features/dashboard.js';
import { updateWorkoutChart, updateTrendChart } from '../features/analytics.js';
import { syncRemoteFoodLogs } from '../features/nutrition.js';
import { renderTrends } from '../features/trends.js';
import { openBodyStatsModal } from './modal.js';

const TAB_PATHS = {
  welcome: '/',
  dashboard: '/dashboard',
  training: '/training',
  nutrition: '/nutrition',
  trends: '/trends',
  profile: '/profile'
};

const PATH_TABS = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/training': 'training',
  '/nutrition': 'nutrition',
  '/trends': 'trends',
  '/profile': 'profile'
};

export function tabFromPath(pathname = location.pathname) {
  return PATH_TABS[pathname] || 'dashboard';
}

export function switchTab(name, replace = false) {
  _rawSwitchTab(name, replace);
}

export function _rawSwitchTab(name, replace = false) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });

  const panel = document.getElementById(`tab-${name}`);
  if (panel) panel.classList.add('active');
  document.body.classList.toggle('show-fab', name === 'dashboard' || name === 'nutrition');

  const path = TAB_PATHS[name] || '/';
  if (location.pathname !== path) {
    history[replace ? 'replaceState' : 'pushState']({ tab: name }, '', path);
  }

  updateNavIndicator();

  if (!state.currentUser) return;

  if (name === 'dashboard') {
    renderDashboardOverview();
  } else if (name === 'training') {
    setTimeout(() => updateWorkoutChart(), 100);
  } else if (name === 'nutrition') {
    syncRemoteFoodLogs();
    setTimeout(() => updateTrendChart(), 100);
  } else if (name === 'trends') {
    renderTrends();
  } else if (name === 'profile') {
    openBodyStatsModal();
  }
}

window.addEventListener('popstate', () => {
  _rawSwitchTab(tabFromPath(), true);
});
