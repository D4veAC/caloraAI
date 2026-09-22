import { showToast } from '../ui/toast.js';

export async function loadTelegramStatus() {
  const label = document.getElementById('telegram-status');
  const button = document.getElementById('telegram-connect-btn');
  try {
    const response = await fetch('/api/telegram/status');
    if (!response.ok) return;
    const status = await response.json();
    if (label) label.textContent = status.connected ? '✓ Telegram sudah terhubung.' : 'Telegram belum terhubung.';
    if (button) button.textContent = status.connected ? 'Hubungkan Ulang' : 'Buat Link Telegram';
  } catch {}
}

export async function connectTelegram() {
  const button = document.getElementById('telegram-connect-btn');
  const actions = document.getElementById('telegram-link-actions');
  button.disabled = true;
  button.textContent = 'Membuat link…';
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
    if (expiry) expiry.textContent = `Link satu-kali ini aktif sampai ${new Date(payload.expiresAt).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}.`;
    if (actions) actions.hidden = false;
    document.getElementById('telegram-status').textContent = 'Link baru siap. Gunakan link ini, bukan tab Telegram lama.';
    showToast('Link Telegram baru siap.', 'success');
  } catch (error) { showToast(error.message, 'danger'); }
  finally {
    button.disabled = false;
    button.textContent = 'Buat Link Baru';
  }
}

export async function copyTelegramCommand() {
  const input = document.getElementById('telegram-start-command');
  if (!input?.value) return;
  try {
    await navigator.clipboard.writeText(input.value);
    showToast('Perintah disalin. Tempel di chat bot Telegram.', 'success');
  } catch {
    input.select();
    showToast('Salin teks yang sudah dipilih.', 'info');
  }
}
