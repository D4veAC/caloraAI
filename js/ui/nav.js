// ==========================================================================
// FITVAULT — Navbar & Active Tab Indicator Manager
// ==========================================================================

import { state } from '../state.js';

export function updateNavIndicator() {
  const indicator = document.getElementById('nav-tab-indicator');
  const container = document.getElementById('nav-tabs-container');
  const activeBtn = container ? container.querySelector('.nav-tab-btn.active') : null;

  if (!indicator || !container) return;

  if (!activeBtn) {
    indicator.style.width = '0px';
    indicator.style.opacity = '0';
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const btnRect       = activeBtn.getBoundingClientRect();

  if (btnRect.width === 0) {
    indicator.style.opacity = '0';
    return;
  }

  const left = btnRect.left - containerRect.left;
  const width = btnRect.width;

  indicator.style.opacity = '1';
  indicator.style.transform = `translateX(${left}px)`;
  indicator.style.width = `${width}px`;
}

export function updateNavUserDisplay() {
  const nameEl = document.getElementById('nav-user-name');
  const accountEl = document.getElementById('profile-account-name');
  const sessionBtn = document.getElementById('profile-session-button');
  const signedIn = Boolean(state.currentUser);
  document.body.classList.toggle('is-authed', signedIn);

  if (nameEl) nameEl.textContent = signedIn ? state.currentUser : 'Guest';
  if (accountEl) accountEl.textContent = signedIn ? state.currentUser : 'Guest';
  if (sessionBtn) {
    sessionBtn.textContent = signedIn ? 'Sign out' : 'Sign in';
    sessionBtn.onclick = () => signedIn ? window.lockApp() : window.openLoginOverlay();
  }
  requestAnimationFrame(updateNavIndicator);
}
