import { apiFetch } from './api';
import { getPrivateCacheContext } from './private-cache-context';
import type { FinanceAttempt, FinanceAttemptContext } from './finance-attempt';
import { validateFinanceDates, type FinanceDates } from '../../../src/lib/finance/summary-integrity';
export type FinanceScope = FinanceDates & { userId: string; organizationId: string; epoch: number; branchId: string | null; currency: string; timeZone: string };
export type Expense = { id: string; branch_id: string; requires_cash_session_on_void?: boolean; concept: string; amount: number; paid_amount: number; outstanding_amount: number; accounting_date: string; due_date: string | null; status: string; currency: string; vendor?: string | null; finance_categories?: { name: string } | null };
export type ExpensePage = { obligations: Expense[]; pagination: { page: number; totalItems: number; totalPages: number } };
export type FinanceCategory = { id: string; name: string };
export type CashSession = { id: string; registerName: string };
export type PayrollEntry = { id: string; employee_display_name: string; base_amount: number; commission_amount: number; net_amount: number; paid_amount: number; outstanding_amount: number; payment_status: string };
export type PayrollRun = { id: string; branch_id?: string | null; period_from: string; period_to: string; status: string; entries: PayrollEntry[] };
export type ProfitabilityRow = { id: string; label: string; revenue: number; directCosts: number | null; grossProfit: number | null; complete: boolean };
export function assertFinanceScope(scope: FinanceScope) {
  const current = getPrivateCacheContext();
  if (current.userId !== scope.userId || current.organizationId !== scope.organizationId || current.epoch !== scope.epoch) throw new Error('La empresa, sucursal o los permisos cambiaron. Volvé a cargar Finanzas.');
}
export function financeQuery(scope: FinanceScope, extra: Record<string, string> = {}) {
  validateFinanceDates(scope);
  const query = new URLSearchParams({ organizationId: scope.organizationId, startDate: scope.startDate, endDate: scope.endDate, ...(scope.branchId ? { branchId: scope.branchId } : {}), ...extra });
  return query.toString();
}
export async function readFinance<T>(path: string, scope: FinanceScope, extra: Record<string, string> = {}): Promise<T> {
  assertFinanceScope(scope);
  const result = await apiFetch<T>(`/api/admin/finances/${path}?${financeQuery(scope, extra)}`);
  assertFinanceScope(scope);
  return result;
}
/**
 * Lee un monto como lo escribe la gente: «150000», «150.000», «1.500.000,50»
 * o «1500,50». El separador de miles es opcional; un punto o una coma seguido
 * de 1 o 2 dígitos al final es el decimal. Devuelve NaN si no es un monto claro.
 */
const GROUPED = { '.': /^\d{1,3}(\.\d{3})+$/, ',': /^\d{1,3}(,\d{3})+$/ } as const;
const GROUPED_OR_PLAIN = { '.': /^\d{1,3}(\.\d{3})*$/, ',': /^\d{1,3}(,\d{3})*$/ } as const;
const WITH_DECIMALS = { '.': /^\d+\.\d{1,2}$/, ',': /^\d+,\d{1,2}$/ } as const;
export function readAmountText(raw: string): number {
  const value = raw.replace(/\s+/g, '');
  if (!value || !/^[\d.,]+$/.test(value)) return NaN;
  const dot = value.lastIndexOf('.'), comma = value.lastIndexOf(',');
  let integer = value, decimals = '';
  if (dot >= 0 && comma >= 0) {
    // Con los dos, el último es el decimal y el otro agrupa miles.
    const decimal = Math.max(dot, comma), group = decimal === dot ? ',' : '.';
    integer = value.slice(0, decimal); decimals = value.slice(decimal + 1);
    if ((integer.includes(decimal === dot ? '.' : ',')) || !GROUPED_OR_PLAIN[group].test(integer) || !/^\d{1,2}$/.test(decimals)) return NaN;
    integer = integer.split(group).join('');
  } else if (dot >= 0 || comma >= 0) {
    const sep = dot >= 0 ? '.' : ',';
    if (GROUPED[sep].test(value)) integer = value.split(sep).join('');
    else if (WITH_DECIMALS[sep].test(value)) [integer, decimals] = value.split(sep);
    else return NaN;
  } else if (!/^\d+$/.test(value)) return NaN;
  if (integer.length > 12) return NaN;
  return Number(decimals ? `${integer}.${decimals}` : integer);
}
export function parseFinanceAmount(raw: string): number {
  const amount = readAmountText(raw.trim());
  if (Number.isNaN(amount)) throw new Error('Revisá el monto. Ejemplos válidos: 150000, 150.000 o 1.500,50.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99) throw new Error('El monto debe ser mayor a cero y estar dentro del límite permitido.');
  return amount;
}
export async function sendFinanceAttempt(scope: FinanceScope, attempt: FinanceAttempt, key: string) {
  assertFinanceScope(scope);
  if (attempt.kind === 'payroll_payment') {
    // El sueldo no lleva sucursal en el pedido: el servidor usa la de la liquidación y valida el acceso.
    if (!attempt.targetId) throw new Error('Falta el empleado a pagar.');
    const paid = await apiFetch<Record<string, unknown>>(`/api/admin/finances/payroll/${encodeURIComponent(attempt.targetId)}/payments?organizationId=${encodeURIComponent(scope.organizationId)}`, {
      method: 'POST', headers: { 'x-idempotency-key': key }, body: JSON.stringify(attempt.payload),
    });
    assertFinanceScope(scope);
    return paid;
  }
  const branch = attempt.payload.branchId;
  if (typeof branch !== 'string' || !branch) throw new Error('Seleccioná una sucursal antes de guardar.');
  if (scope.branchId && scope.branchId !== branch) throw new Error('La sucursal de la operación no coincide con la seleccionada.');
  const path = attempt.kind === 'expense' ? 'obligations' : `obligations/${encodeURIComponent(attempt.targetId ?? '')}/payments`;
  const result = await apiFetch<Record<string, unknown>>(`/api/admin/finances/${path}?organizationId=${encodeURIComponent(scope.organizationId)}`, {
    method: 'POST', headers: { 'x-idempotency-key': key }, body: JSON.stringify(attempt.payload),
  });
  assertFinanceScope(scope);
  return result;
}
/** Anula un gasto (queda registrado como anulado, no se borra). */
export async function voidExpense(scope: FinanceScope, expense: Pick<Expense, 'id' | 'branch_id'>, reason: string, cashSessionId?: string) {
  assertFinanceScope(scope);
  const text = reason.trim();
  if (!text) throw new Error('Escribí el motivo de la anulación.');
  if (scope.branchId && scope.branchId !== expense.branch_id) throw new Error('El gasto es de otra sucursal.');
  const result = await apiFetch<Record<string, unknown>>(`/api/admin/finances/obligations/${encodeURIComponent(expense.id)}?organizationId=${encodeURIComponent(scope.organizationId)}`, {
    method: 'DELETE', body: JSON.stringify({ branchId: expense.branch_id, reason: text.slice(0, 1000), ...(cashSessionId ? { cashSessionId } : {}) }),
  });
  assertFinanceScope(scope);
  return result;
}
/** Aprueba una liquidación en borrador: recién ahí se pueden registrar los pagos. */
export async function approvePayrollRun(scope: FinanceScope, runId: string) {
  assertFinanceScope(scope);
  const result = await apiFetch<Record<string, unknown>>(`/api/admin/finances/payroll/${encodeURIComponent(runId)}/approve?organizationId=${encodeURIComponent(scope.organizationId)}`, { method: 'POST' });
  assertFinanceScope(scope);
  return result;
}
export const financeAttemptContext = (scope: FinanceScope): FinanceAttemptContext => ({ userId: scope.userId, organizationId: scope.organizationId });
export function assertExpensePage(page: ExpensePage) {
  if (!Array.isArray(page.obligations) || !page.pagination || !Number.isInteger(page.pagination.totalItems) || page.pagination.totalItems < 0 || !Number.isInteger(page.pagination.page) || page.pagination.page < 1 || !Number.isInteger(page.pagination.totalPages) || page.pagination.totalPages < 0) throw new Error('La lista de gastos llegó incompleta. Reintentá.');
  for (const row of page.obligations) {
    if (![row.amount,row.paid_amount,row.outstanding_amount].every(value => typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value))) || !/^[A-Z]{3}$/.test(row.currency)) throw new Error('El gasto no tiene importes o moneda verificables.');
    const amount = Number(row.amount), paid = Number(row.paid_amount), due = Number(row.outstanding_amount);
    if (![amount, paid, due].every(Number.isFinite) || amount < 0 || paid < 0 || due < 0 || Math.abs(due - (row.status === 'voided' ? 0 : Math.max(0, amount - paid))) > 0.021) throw new Error('Hay un gasto con saldo inconsistente. No se habilitaron pagos.');
  }
}