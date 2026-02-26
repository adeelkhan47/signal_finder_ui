export function formatTimestamp(ms: string): { date: string; time: string } {
  const n = parseInt(ms, 10);
  if (Number.isNaN(n)) return { date: '—', time: '—' };
  const d = new Date(n);
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
}

/** Convert datetime-local value (YYYY-MM-DDTHH:mm) to API format YYYY-MM-DD HH:mm:00 */
export function toApiDateTime(local: string): string {
  if (!local) return '';
  const s = local.replace('T', ' ');
  return s.length === 16 ? `${s}:00` : s;
}

/** Compute start and end as API datetime strings for "last N days" (end = now) */
export function lastDaysToRange(days: number): { starttime: string; endtime: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(0, days));
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  return { starttime: fmt(start), endtime: fmt(end) };
}

/** Clean comma-separated string into trimmed non-empty tokens (e.g. ",origin,phase-data,shakemap," → ["origin", "phase-data", "shakemap"]) */
export function parseCommaSeparated(value: string): string[] {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Format channel distance string (e.g. "7508.230393078459 KM") to 2 decimal places */
export function formatChannelDistance(value: string | undefined): string {
  if (!value || typeof value !== 'string') return '—';
  const num = parseFloat(value.replace(/\s*KM$/i, '').trim());
  if (Number.isNaN(num)) return value;
  return num.toFixed(2);
}

/** Format latitude/longitude to 3 decimal places */
export function formatCoord(value: string | undefined): string {
  if (value == null || value === '') return '—';
  const num = parseFloat(String(value).trim());
  if (Number.isNaN(num)) return String(value);
  return num.toFixed(3);
}

/** Format depth to 2 decimal places */
export function formatDepth(value: string | undefined): string {
  if (value == null || value === '') return '—';
  const num = parseFloat(String(value).trim());
  if (Number.isNaN(num)) return String(value);
  return num.toFixed(2);
}
