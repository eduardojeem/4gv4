/** Fechas en formato del sistema (AAAA-MM-DD), sin zona horaria: son días calendario. */
export type IsoDay = string;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function isIsoDay(value: string): boolean {
  const match = ISO.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isoDay(year: number, monthIndex: number, day: number): IsoDay {
  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** «15/11/2026», como se lee en Paraguay. */
export function formatDay(value: IsoDay): string {
  if (!isIsoDay(value)) return value;
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

export function shiftMonth(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const total = year * 12 + monthIndex + delta;
  return { year: Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 };
}

/**
 * Las semanas del mes empezando en lunes; los huecos antes del día 1 y después
 * del último son null.
 */
export function monthGrid(year: number, monthIndex: number): (number | null)[][] {
  const first = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay(); // 0 = domingo
  const offset = (first + 6) % 7; // lunes = 0
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
