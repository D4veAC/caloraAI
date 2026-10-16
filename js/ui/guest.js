import { state } from '../state.js';

export function requireAuth(event) {
  if (state.currentUser) return true;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  document.dispatchEvent(new CustomEvent('auth:required'));
  return false;
}
