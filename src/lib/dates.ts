// Local-time day helpers. A "day key" is YYYY-MM-DD in the device's timezone.
export const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date | number): string {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / DAY_MS);
}

/** Inclusive list of day keys from `from` to `to`. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Monday-based week start. */
export function weekStart(key: string): string {
  const d = parseDay(key);
  const dow = (d.getDay() + 6) % 7;
  return addDays(key, -dow);
}

export function today(): string {
  return dayKey(new Date());
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const fmt = {
  /** Sep 22 */
  short: (key: string) => {
    const d = parseDay(key);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  },
  /** Tue, Sep 22 */
  dowShort: (key: string) => {
    const d = parseDay(key);
    return `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  },
  /** Sep 22, 2026 */
  long: (key: string) => {
    const d = parseDay(key);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  },
  /** Tuesday, September 22 */
  full: (key: string) => {
    const d = parseDay(key);
    return `${DOW_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
  },
  monthYear: (ms: number) => {
    const d = new Date(ms);
    return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
  },
  month: (key: string) => MONTHS_LONG[parseDay(key).getMonth()],
  time: (ms: number) => {
    const d = new Date(ms);
    const h = d.getHours();
    return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
  },
  dayName: (dow: number) => DOW_LONG[dow],
};

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
