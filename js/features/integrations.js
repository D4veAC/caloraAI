import { showToast } from '../ui/toast.js';
import { state } from '../state.js';
import { requireAuth } from '../ui/guest.js';

export async function loadTelegramStatus() {
  if (!state.currentUser) return;
  const label = document.getElementById('telegram-status');
  const button = document.getElementById('telegram-connect-btn');
  try {
    const response = await fetch('/api/telegram/status');
    if (!response.ok) return;
    const status = await response.json();
    if (label) label.textContent = status.connected ? 'Telegram is connected.' : 'Telegram is not connected.';
    if (button) button.textContent = status.connected ? 'Reconnect Telegram' : 'Create Telegram link';
  } catch {}
}

export async function connectTelegram() {
  if (!requireAuth()) return;
  const button = document.getElementById('telegram-connect-btn');
  const actions = document.getElementById('telegram-link-actions');
  button.disabled = true;
  button.textContent = 'Creating link…';
  try {
    const response = await fetch('/api/telegram/bind-token', { method:'POST' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Connection link could not be created');
    const command = `/start ${payload.startPayload}`;
    const link = document.getElementById('telegram-open-link');
    const commandInput = document.getElementById('telegram-start-command');
    const expiry = document.getElementById('telegram-link-expiry');
    if (link) {
      link.href = payload.deepLink || `https://t.me/Calor4_bot`;
      link.hidden = !payload.deepLink;
    }
    if (commandInput) commandInput.value = command;
    if (expiry) expiry.textContent = `This one-time link works until ${new Date(payload.expiresAt).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}.`;
    if (actions) actions.hidden = false;
    document.getElementById('telegram-status').textContent = 'A new link is ready. Use this link, not an old Telegram tab.';
    showToast('Telegram link is ready.', 'success');
  } catch (error) { showToast(error.message, 'danger'); }
  finally {
    button.disabled = false;
    button.textContent = 'Create a new link';
  }
}

export async function copyTelegramCommand() {
  if (!requireAuth()) return;
  const input = document.getElementById('telegram-start-command');
  if (!input?.value) return;
  try {
    await navigator.clipboard.writeText(input.value);
    showToast('Command copied. Paste it in the Telegram bot chat.', 'success');
  } catch {
    input.select();
    showToast('Copy the selected text.', 'info');
  }
}
