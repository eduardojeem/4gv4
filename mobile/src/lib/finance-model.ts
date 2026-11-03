import type { FinanceSummaryData } from './admin';

export type FinancePeriod = 'today' | 'month' | '30d' | 'year';

/** Días del negocio, sin depender del huso horario del teléfono ni de cambios de horario. */
export function financePeriodDates(
  period: FinancePeriod,
  timeZone: string,
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) =>
    parts.find((item) => item.type === name)?.value ?? '';
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  let startDate = today;
  if (period === 'month') startDate = `${today.slice(0, 7)}-01`;
  if (period === 'year') startDate = `${today.slice(0, 4)}-01-01`;
  if (period === '30d') {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 29);
    startDate = date.toISOString().slice(0, 10);
  }
  return { startDate, endDate: today };
}

export const financeReportKey = (
  organizationId: string | null,
  epoch: number,
  period: FinancePeriod,
  branch: string,
) => JSON.stringify([organizationId, epoch, period, branch]);
export function financeResultState(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'No calculable';
  return value === 0
    ? 'Sin ganancia ni pérdida'
    : value > 0
      ? 'Ganancia neta'
      : 'Pérdida neta';
}
export function isEmptyFinanceSummary(data: FinanceSummaryData) {
  return (
    data.complete !== false &&
    !data.coverageWarnings?.length &&
    Object.values(data.accrued).every((value) => value === 0) &&
    Object.values(data.cash).every((value) => value === 0) &&
    !data.overdue.length &&
    !data.upcomingDue.length
  );
}
