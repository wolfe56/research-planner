export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const pad = n => String(n).padStart(2, '0');
export const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => dateStr(new Date());
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() + 6) % 7)); // weeks start on Monday
}

// Scheduled starts are stored as local wall-clock time: "YYYY-MM-DDTHH:MM".
export const startStr = (date, min) => `${date}T${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const minutesOf = s => { const [h, m] = s.slice(11, 16).split(':').map(Number); return h * 60 + m; };
export function parseStart(s) { const d = parseDate(s.slice(0, 10)); const m = minutesOf(s); d.setHours(Math.floor(m / 60), m % 60); return d; }

export function fmtDur(min) {
  if (!min) return '0m';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
export function fmtTime(min) {
  const h = Math.floor(min / 60) % 24, m = min % 60;
  return `${h % 12 || 12}${m ? ':' + pad(m) : ''}${h >= 12 ? 'pm' : 'am'}`;
}
export const fmtDay = d => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export function fmtShortDate(s) {
  const d = parseDate(s);
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}
export const fmtWhen = s => `${fmtDay(parseStart(s))}, ${fmtTime(minutesOf(s))}`;

export const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0);
// Key for a task group: one project's tasks in one experiment (or in no experiment).
export const gkey = (projectId, experimentId) => `${projectId}|${experimentId || ''}`;

export const PALETTE = ['#3b6fd8', '#e8590c', '#2f9e44', '#9c36b5', '#0c8599', '#d6336c', '#c79100', '#5c7cfa', '#8b5a2b', '#868e96'];
export const ROLES = [['lead', 'Lead'], ['subpi', 'Sub-PI'], ['support', 'Support'], ['helper', 'Helper']];
export const roleLabel = r => (ROLES.find(x => x[0] === r) || ROLES[0])[1];
export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];
export const REAGENT_STATUS = { need: 'Need to order', ordered: 'Ordered', arrived: 'Arrived', have: 'In stock' };
// Reagents in these states keep their experiment waiting.
export const isPending = r => r.status === 'need' || r.status === 'ordered';
