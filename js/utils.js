// ==========================================================================
// FITVAULT — Pure Utility Functions (no side effects, no imports)
// ==========================================================================

/** HTML-escape a string to prevent XSS */
export function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])
  );
}

/** Format seconds → "HH:MM:SS" or "MM:SS" */
export function formatTime(seconds) {
  const s = parseInt(seconds) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [
    h > 0 ? String(h).padStart(2, '0') : null,
    String(m).padStart(2, '0'),
    String(sec).padStart(2, '0')
  ].filter(Boolean).join(':');
}

/** Grade today's nutrition A/B/C/D/N/A */
export function calcNutriGrade(kcal = 0, targetKcal = 2350, protein = 0, targetP = 130) {
  if (!kcal || kcal === 0) return { grade: 'N/A', cls: 'rating-na', label: 'No Logs' };
  const kcalPct = (kcal / targetKcal) * 100;
  const pPct    = targetP > 0 ? (protein / targetP) * 100 : 100;

  if (kcalPct >= 80 && kcalPct <= 105 && pPct >= 75) return { grade: 'A', cls: 'rating-a', label: 'Optimal' };
  if ((kcalPct >= 65 && kcalPct < 80) || (kcalPct > 105 && kcalPct <= 120)) return { grade: 'B', cls: 'rating-b', label: 'Good' };
  if ((kcalPct >= 45 && kcalPct < 65) || (kcalPct > 120 && kcalPct <= 135)) return { grade: 'C', cls: 'rating-c', label: 'Fair' };
  return { grade: 'D', cls: 'rating-d', label: 'Alert' };
}

/**
 * Resolve a reliable ms timestamp from a workout entry.
 * Handles: ISO createdAt, numeric timestamp, short-format date strings ("5 Aug" → fix year).
 * Shared helper used by both workout.js and analytics.js to avoid circular imports.
 */
export function getWorkoutTimestamp(w) {
  if (w.createdAt)  return new Date(w.createdAt).getTime();
  if (w.timestamp)  return Number(w.timestamp);
  if (w.date) {
    const d = new Date(w.date);
    if (!isNaN(d.getTime())) {
      // Short format like "5 Aug" parses as year 2001 — correct it to current year
      if (d.getFullYear() < 2020) d.setFullYear(new Date().getFullYear());
      return d.getTime();
    }
  }
  return Date.now();
}
