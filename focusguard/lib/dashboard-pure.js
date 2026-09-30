// focusguard/lib/dashboard-pure.js — pure functions, no Chrome or DOM deps.
// Imported by both dashboard.js (page script) and tests/.

export function formatDuration(ms) {
  if (!ms || ms < 1000) return '<1s';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return sec + 's';
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return remSec ? `${min}m ${remSec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin ? `${hr}h ${remMin}m` : `${hr}h`;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
