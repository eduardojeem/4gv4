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
    // Solo los importes: la apertura de ingresos es un objeto y nunca es 0.
    (['revenue', 'directCosts', 'grossProfit', 'operatingExpenses', 'payrollCost', 'netProfit'] as const)
      .every((key) => data.accrued[key] === 0 || data.accrued[key] === null) &&
    Object.values(data.cash).every((value) => value === 0) &&
    !data.overdue.length &&
    !data.upcomingDue.length
  );
}

/**
 * Lo que la pantalla muestra en grande. El servidor no calcula la ganancia si
 * a alguna venta le falta el costo, y en un comercio chico eso pasa casi
 * siempre: en ese caso se muestra igual, marcada como estimada (sale más alta
 * de lo real, porque esas ventas cuentan sin costo).
 */
export function financeHeadline(data: FinanceSummaryData) {
  const { revenue, directCosts, operatingExpenses, payrollCost, netProfit } = data.accrued;
  const exact = netProfit != null && Number.isFinite(netProfit);
  const profit = exact ? netProfit : revenue - directCosts - operatingExpenses - payrollCost;
  return {
    profit,
    estimated: !exact,
    /** Cuánto queda de cada 100 vendidos; sin ventas no hay margen. */
    marginPct: revenue > 0 ? Math.round((profit / revenue) * 100) : null,
  };
}

/**
 * «15 % más que el período anterior», en palabras. Sin base de comparación no
 * se inventa un porcentaje. Misma regla que la web (`src/lib/finance/headline.ts`).
 */
export function comparisonText(current: number | null, previous: number | null | undefined): string | null {
  if (current === null || previous === null || previous === undefined) return null;
  if (previous === 0) return current === 0 ? 'Igual que el período anterior' : null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 0.5) return 'Igual que el período anterior';
  const rounded = Math.round(Math.abs(change));
  return change > 0 ? `${rounded} % más que el período anterior` : `${rounded} % menos que el período anterior`;
}

/**
 * El saldo de «Cobros y pagos» en palabras: con signo explícito y una frase,
 * porque un número suelto («Diferencia») no decía si era bueno o malo.
 */
export function cashBalance(net: number) {
  const value = Number.isFinite(net) ? net : 0;
  if (value > 0) return { sign: '+', tone: 'good' as const, text: 'Entró más plata de la que salió.' };
  if (value < 0) return { sign: '−', tone: 'bad' as const, text: 'Salió más plata de la que entró.' };
  return { sign: '', tone: 'neutral' as const, text: 'Entró lo mismo que salió.' };
}

/** Cuentas a pagar en los próximos 7 días y las que vienen después. */
export function splitDueThisWeek<T extends { dueDate: string }>(items: T[], today: string) {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 7);
  const last = limit.toISOString().slice(0, 10);
  return {
    thisWeek: items.filter((item) => item.dueDate <= last),
    later: items.filter((item) => item.dueDate > last),
  };
}

const SOURCE_NAMES: Record<string, [string, string]> = {
  sale: ['venta', 'ventas'],
  order: ['pedido', 'pedidos'],
  repair: ['reparación', 'reparaciones'],
};
const plural = (count: number, [one, many]: [string, string]) => `${count} ${count === 1 ? one : many}`;

export type FinanceWarningGroup = { code: string; title: string; hint: string; count: number };

/** Las advertencias del informe agrupadas, en palabras del comercio y no una por venta. */
export function groupFinanceWarnings(warnings: FinanceSummaryData['coverageWarnings']): FinanceWarningGroup[] {
  const groups = new Map<string, FinanceWarningGroup & { sources: Map<string, number> }>();
  for (const warning of warnings ?? []) {
    const group = groups.get(warning.code) ?? { code: warning.code, title: '', hint: '', count: 0, sources: new Map() };
    group.count++;
    const source = warning.sourceType ?? '';
    group.sources.set(source, (group.sources.get(source) ?? 0) + 1);
    if (!group.hint) group.hint = warning.message;
    groups.set(warning.code, group);
  }
  return [...groups.values()].map(({ sources, ...group }) => {
    const items = [...sources.entries()]
      .map(([source, count]) => plural(count, SOURCE_NAMES[source] ?? ['registro', 'registros']))
      .join(', ');
    if (group.code === 'MISSING_DIRECT_COST') {
      return { ...group, title: `${items} sin costo cargado`, hint: 'La ganancia sale más alta de lo real hasta que cargues cuánto te costaron esos productos.' };
    }
    if (group.code === 'MISSING_CASH_TIMING') {
      return { ...group, title: `${items} con cobros sin fecha`, hint: 'No sabemos qué día entró esa plata, así que puede faltar en «Cobraste».' };
    }
    if (group.code === 'REJECTED_PAYMENT') {
      return { ...group, title: `${plural(group.count, ['cobro rechazado', 'cobros rechazados'])} con tarjeta o transferencia`, hint: 'Esa plata no entró. Revisá si el cliente pagó de otra forma.' };
    }
    if (group.code === 'MISSING_REPAIR_PRICE') {
      return { ...group, title: `${plural(group.count, ['reparación entregada', 'reparaciones entregadas'])} sin precio`, hint: 'Cuentan como venta cero hasta que cargues lo que cobraste.' };
    }
    return { ...group, title: plural(group.count, ['dato para revisar', 'datos para revisar']) };
  });
}

/**
 * Partes de lo vendido para la barra «a dónde va cada guaraní». Solo con
 * ventas y sin pérdida: con pérdida los gastos pasan el 100 % y la barra mentiría.
 */
export function financeBreakdown(data: FinanceSummaryData, profit: number) {
  const { revenue, directCosts, operatingExpenses, payrollCost } = data.accrued;
  if (!(revenue > 0) || profit < 0) return null;
  const share = (value: number) => Math.max(0, value) / revenue;
  return {
    goods: share(directCosts),
    expenses: share(operatingExpenses),
    payroll: share(payrollCost),
    profit: share(profit),
  };
}

export const sumDue = (items: FinanceSummaryData['overdue']) =>
  items.reduce((total, item) => total + (Number.isFinite(item.amount) ? item.amount : 0), 0);
