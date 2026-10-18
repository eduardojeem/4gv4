import { fetchCustomerDebts } from './customers';

/**
 * Venta a crédito desde el POS de la app, con las mismas cuentas que la web
 * (src/lib/credits/installments.ts y pos-credit-summary.ts): el servidor arma
 * el crédito en la misma transacción de la venta y devuelve el calendario que
 * guardó; esto es la vista previa antes de confirmar.
 */

export type CreditFrequency = 'weekly' | 'biweekly' | 'monthly';
export type FirstInstallmentTiming = 'at_start' | 'next_cycle';
/** Cobro de la cuota 1 en el momento (solo si las cuotas empiezan hoy). No cambia las demás. */
export type FirstPayment = { method: 'cash'; cashReceived: number } | { method: 'transfer'; bank: string; reference: string };
export type CreditTerms = { count: number; frequency: CreditFrequency; interestRate: number; timing: FirstInstallmentTiming; firstPayment?: FirstPayment | null };
export type PlanInstallment = { number: number; dueDate: string; amount: number };
export type CreditPlan = { principal: number; interestAmount: number; financedTotal: number; installments: PlanInstallment[] };

export const DEFAULT_TERMS: CreditTerms = { count: 1, frequency: 'monthly', interestRate: 0, timing: 'at_start' };

export const FREQUENCY_LABEL: Record<CreditFrequency, string> = { weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' };

/** Hoy en Paraguay (la fecha de inicio que usa el servidor). */
export function creditBusinessDate(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const value = ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  } catch {
    // Sin zonas horarias en el motor: Paraguay está en UTC−3 todo el año.
  }
  return new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

const ymd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Guaraníes: sin decimales. El sobrante va entero a la última cuota.
function split(total: number, count: number) {
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) => (index === count - 1 ? total - base * (count - 1) : base));
}

function dueDate(base: Date, index: number, frequency: CreditFrequency, fromStart: boolean) {
  const date = new Date(base);
  const step = fromStart ? index : index + 1;
  if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7 * step);
    return date;
  }
  if (frequency === 'biweekly') {
    date.setDate(date.getDate() + 15 * step);
    return date;
  }
  // Mensual: conserva el día pactado y lo recorta en los meses que no lo tienen.
  const day = base.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + step);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return date;
}

export function buildCreditPlan(principalAmount: number, terms: CreditTerms): CreditPlan {
  const principal = Math.max(0, Math.round(principalAmount));
  const count = Math.min(60, Math.max(1, Math.floor(terms.count) || 1));
  const interestAmount = Math.round(principal * (Math.max(0, terms.interestRate) / 100));
  const principalParts = split(principal, count);
  const interestParts = split(interestAmount, count);
  const [y, m, d] = creditBusinessDate().split('-').map(Number);
  const start = new Date(y, m - 1, d, 12);
  return {
    principal,
    interestAmount,
    financedTotal: principal + interestAmount,
    installments: Array.from({ length: count }, (_, index) => ({
      number: index + 1,
      dueDate: ymd(dueDate(start, index, terms.frequency, terms.timing !== 'next_cycle')),
      amount: principalParts[index] + interestParts[index],
    })),
  };
}

/** El calendario que guardó el servidor, si vino en la respuesta de la venta. */
export function persistedPlan(value: unknown, fallback: CreditPlan): CreditPlan {
  if (!value || typeof value !== 'object') return fallback;
  const schedule = value as { installments?: unknown; financedTotal?: unknown; interestAmount?: unknown; baseTotal?: unknown };
  const rows = Array.isArray(schedule.installments) ? schedule.installments : [];
  const installments = rows.filter(
    (row): row is PlanInstallment => Boolean(row) && Number.isInteger((row as PlanInstallment).number) && typeof (row as PlanInstallment).dueDate === 'string' && Number.isFinite((row as PlanInstallment).amount)
  );
  if (installments.length === 0) return fallback;
  const num = (v: unknown, other: number) => (Number.isFinite(Number(v)) ? Number(v) : other);
  return {
    principal: num(schedule.baseTotal, fallback.principal),
    interestAmount: num(schedule.interestAmount, fallback.interestAmount),
    financedTotal: num(schedule.financedTotal, installments.reduce((sum, row) => sum + row.amount, 0)),
    installments,
  };
}

/**
 * La entrega más chica para que el resto, con su interés, entre en el
 * disponible. Null si no hace falta o si no alcanza. Un guaraní de margen con
 * interés, igual que la web (el redondeo podía pasarse por uno).
 */
export function minimumDownPayment(total: number, available: number, interestRate: number) {
  if (available <= 0 || total <= 0) return null;
  const rate = Math.max(0, interestRate) / 100;
  const maxPrincipal = Math.max(0, Math.floor(available / (1 + rate)) - (rate > 0 ? 1 : 0));
  if (maxPrincipal >= total) return null;
  const minimum = Math.ceil(total - maxPrincipal);
  return minimum < total ? minimum : null;
}

export type CreditStatus = { limit: number; used: number; available: number; overdue: number };

/** Límite y deuda real del cliente (cuotas pendientes), la misma cuenta que decide el servidor. */
export async function fetchCreditStatus(customerId: string): Promise<CreditStatus> {
  const summary = await fetchCustomerDebts(customerId);
  const installments = summary.debts.filter((debt) => debt.type === 'installment');
  const used = installments.reduce((sum, debt) => sum + Math.max(0, debt.pendingAmount), 0);
  const overdue = installments.filter((debt) => debt.isOverdue).reduce((sum, debt) => sum + Math.max(0, debt.pendingAmount), 0);
  const limit = Math.max(0, summary.creditLimit);
  return { limit, used, available: Math.max(0, limit - used), overdue };
}

/** Mismas reglas que src/lib/credits/first-payment.ts. */
export function firstPaymentError(payment: FirstPayment | null | undefined, amount: number, timing: FirstInstallmentTiming) {
  if (!payment) return null;
  if (timing !== 'at_start') return 'La primera cuota solo se cobra si las cuotas empiezan hoy.';
  if (!(amount > 0)) return 'La primera cuota debe tener un importe mayor a cero.';
  if (payment.method === 'cash') return payment.cashReceived < amount ? 'El efectivo recibido no cubre la primera cuota.' : null;
  return !payment.bank.trim() || !payment.reference.trim() ? 'Anotá el banco o cuenta y la referencia de la transferencia de la cuota.' : null;
}

export const shortDate = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
};
