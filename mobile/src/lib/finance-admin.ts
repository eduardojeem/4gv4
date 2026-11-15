import { apiFetch } from './api';
import { getPrivateCacheContext } from './private-cache-context';
import type { FinanceAttempt, FinanceAttemptContext } from './finance-attempt';
import { validateFinanceDates, type FinanceDates } from '../../../src/lib/finance/summary-integrity';
export type FinanceScope = FinanceDates & { userId: string; organizationId: string; epoch: number; branchId: string | null; currency: string; timeZone: string };
export type Expense = { id: string; branch_id: string; concept: string; amount: number; paid_amount: number; outstanding_amount: number; accounting_date: string; due_date: string | null; status: string; currency: string; vendor?: string | null; finance_categories?: { name: string } | null };
export type ExpensePage = { obligations: Expense[]; pagination: { page: number; totalItems: number; totalPages: number } };
export type FinanceCategory = { id: string; name: string };
export type CashSession = { id: string; registerName: string };
export type PayrollEntry = { id: string; employee_display_name: string; base_amount: number; commission_amount: number; net_amount: number; paid_amount: number; outstanding_amount: number; payment_status: string };
export type PayrollRun = { id: string; period_from: string; period_to: string; status: string; entries: PayrollEntry[] };
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
export function parseFinanceAmount(raw: string): number {
  const value = raw.trim();
  if (!/^\d{1,12}([.,]\d{1,2})?$/.test(value)) throw new Error('Ingresá el monto sin separador de miles, con hasta dos decimales. Ejemplo: 150000 o 1500,50.');
  const amount = Number(value.replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99) throw new Error('El monto debe ser mayor a cero y estar dentro del límite permitido.');
  return amount;
}
export async function sendFinanceAttempt(scope: FinanceScope, attempt: FinanceAttempt, key: string) {
  assertFinanceScope(scope);
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
export const financeAttemptContext = (scope: FinanceScope): FinanceAttemptContext => ({ userId: scope.userId, organizationId: scope.organizationId });
export function assertExpensePage(page: ExpensePage) {
  if (!Array.isArray(page.obligations) || !page.pagination || !Number.isInteger(page.pagination.totalItems) || page.pagination.totalItems < 0 || !Number.isInteger(page.pagination.page) || page.pagination.page < 1 || !Number.isInteger(page.pagination.totalPages) || page.pagination.totalPages < 0) throw new Error('La lista de gastos llegó incompleta. Reintentá.');
  for (const row of page.obligations) {
    if (![row.amount,row.paid_amount,row.outstanding_amount].every(value => typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value))) || !/^[A-Z]{3}$/.test(row.currency)) throw new Error('El gasto no tiene importes o moneda verificables.');
    const amount = Number(row.amount), paid = Number(row.paid_amount), due = Number(row.outstanding_amount);
    if (![amount, paid, due].every(Number.isFinite) || amount < 0 || paid < 0 || due < 0 || Math.abs(due - (row.status === 'voided' ? 0 : Math.max(0, amount - paid))) > 0.021) throw new Error('Hay un gasto con saldo inconsistente. No se habilitaron pagos.');
  }
}