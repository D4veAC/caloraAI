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
  const profileBtn = document.getElementById('nav-profile-button');
  const lockBtn = document.getElementById('nav-session-button');

  if (state.currentUser) {
    if (nameEl) nameEl.textContent = state.currentUser;
    if (profileBtn) profileBtn.hidden = false;
    if (lockBtn) {
      lockBtn.textContent = 'Lock';
      lockBtn.onclick = () => window.lockApp();
      lockBtn.className = 'btn btn-ghost btn-sm';
    }
  } else {
    if (nameEl) nameEl.textContent = 'Guest';
    if (profileBtn) profileBtn.hidden = true;
    if (lockBtn) {
      lockBtn.textContent = 'Login';
      lockBtn.onclick = () => window.switchTab('dashboard');
      lockBtn.className = 'btn btn-fill btn-sm';
    }
  }
}
