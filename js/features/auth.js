import { state } from '../state.js';
import { _rawSwitchTab, tabFromPath } from '../ui/router.js';
import { showToast } from '../ui/toast.js';
import { updateNavUserDisplay } from '../ui/nav.js';
import { renderDashboardOverview, syncAdaptiveDashboard } from './dashboard.js';
import { renderFoodLog, syncRemoteFoodLogs } from './nutrition.js';
import { syncWebhookWorkouts } from './workout.js';

let _loginUsername = '';

function applyAuthenticatedUser(user) {
  state.setCurrentUser(user.name, user.id, user.role);
  if (user.profile) state.setBodyStats(user.profile);
  updateNavUserDisplay();
}

export async function checkAuth() {
  try {
    const response = await fetch('/api/session');
    if (response.ok) {
      const { user } = await response.json();
      applyAuthenticatedUser(user);
      await syncAdaptiveDashboard();
      const next = tabFromPath();
      _rawSwitchTab(next === 'welcome' ? 'dashboard' : next, true);
      return true;
    }
  } catch {}
  state.setCurrentUser(null, null, null);
  _rawSwitchTab('welcome', true);
  return false;
}

export function closeLoginOverlay() {
  document.getElementById('pin-lock-overlay')?.classList.remove('open', 'unlocking');
  _rawSwitchTab('welcome');
}

export function openLoginOverlay() {
  _loginUsername = '';
  document.getElementById('login-step-1')?.classList.remove('login-step--hidden');
  document.getElementById('login-step-2')?.classList.add('login-step--hidden');
  document.getElementById('login-error-msg').textContent = '';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('pin-lock-overlay')?.classList.add('open');
  setTimeout(() => document.getElementById('login-username')?.focus(), 100);
}

export function submitUsername() {
  const value = document.getElementById('login-username')?.value.trim();
  if (!value) return;
  _loginUsername = value;
  document.getElementById('login-step-1')?.classList.add('login-step--hidden');
  document.getElementById('login-step-2')?.classList.remove('login-step--hidden');
  document.getElementById('login-error-msg').textContent = '';
  setTimeout(() => document.getElementById('login-password')?.focus(), 50);
}

export function loginGoBack() {
  _loginUsername = '';
  document.getElementById('login-step-1')?.classList.remove('login-step--hidden');
  document.getElementById('login-step-2')?.classList.add('login-step--hidden');
  document.getElementById('login-error-msg').textContent = '';
  setTimeout(() => document.getElementById('login-username')?.focus(), 50);
}

export async function submitPassword() {
  const passwordInput = document.getElementById('login-password');
  const button = document.getElementById('login-unlock-btn');
  const error = document.getElementById('login-error-msg');
  if (!passwordInput?.value || !_loginUsername || button.disabled) return;
  button.disabled = true;
  button.textContent = 'Signing in…';
  error.textContent = '';
  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: _loginUsername, password: passwordInput.value })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Unable to sign in');
    applyAuthenticatedUser(payload.user);
    document.getElementById('pin-lock-overlay')?.classList.remove('open');
    _rawSwitchTab(state.pendingTab || 'dashboard');
    await Promise.all([syncRemoteFoodLogs(), syncWebhookWorkouts()]);
    await syncAdaptiveDashboard();
    renderFoodLog();
    renderDashboardOverview();
    showToast(`Welcome back, ${payload.user.name}`, 'success');
  } catch (loginError) {
    passwordInput.value = '';
    error.textContent = loginError.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Unlock';
  }
}

export async function lockApp() {
  try { await fetch('/api/session', { method: 'DELETE' }); } catch {}
  state.setCurrentUser(null, null, null);
  state.pendingTab = 'dashboard';
  updateNavUserDisplay();
  _rawSwitchTab('welcome');
  showToast('Logged out', 'info');
}
