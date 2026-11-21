import type { CollectInput, InstallmentRow } from './customers';
import { creditCalendarDate,creditInstallmentIsOverdue } from '../../../src/lib/credits/calendar';
import { formatMoneyInput, MAX_MONEY_INPUT, moneyFractionDigits, parseMoneyInput } from '../../../src/lib/credits/money-input';
export const roundCreditMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
/** Monto escrito a mano: el punto separa miles y la coma, decimales (0 decimales en guaraníes). */
export function parseCreditAmount(raw: string, currency: string): number { return parseMoneyInput(raw, currency); }
export const formatCreditAmountInput = (value: number, currency: string) => formatMoneyInput(value, currency);
export function formatCreditMoney(value: number, currency: string) { if (!Number.isFinite(value) || !currency || !/^[A-Z]{3}$/.test(currency))
    return 'No disponible'; const digits = moneyFractionDigits(currency); return new Intl.NumberFormat('es-PY', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value); }
function amount(value: unknown) { if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0)
    throw new Error('Hay importes no verificables. Reintentá antes de consultar saldos.'); return Number(value); }
export function creditTotals(rows: Pick<InstallmentRow, 'amount' | 'amount_paid' | 'status'>[]) { let total = 0, paid = 0; for (const row of rows) {
    const value = amount(row.amount), collected = amount(row.amount_paid ?? (row.status === 'paid' ? value : 0));
    if (row.status === 'paid' && collected < value - 0.01)
        throw new Error('Una cuota marcada como pagada no coincide con sus pagos.');
    if (collected > value + 0.01)
        throw new Error('Una cuota tiene más pagos que su importe. Revisá el registro.');
    total += value;
    paid += collected;
} return { total: roundCreditMoney(total), paid: roundCreditMoney(paid), pending: roundCreditMoney(Math.max(0, total - paid)) }; }
export const creditIsLate = creditInstallmentIsOverdue;
function positiveAmount(value: number) { if (!Number.isFinite(value) || value <= 0 || value > MAX_MONEY_INPUT || Math.abs(Math.round(value * 100) / 100 - value) > 1e-9)
    throw new Error('El monto debe ser mayor a cero y estar dentro del límite permitido.'); }
export function creditCollectionPayload(input: CollectInput, key: string) { positiveAmount(input.amount); for (const row of input.allocations ?? [])
    if (row.amount !== 0) positiveAmount(row.amount); return { amount: input.amount, paymentMethod: input.method, mode: input.allocations?.length ? 'manual' : 'auto', ...(input.allocations?.length ? { allocations: input.allocations.map(row => ({ ...row })) } : {}), referenceNumber: input.referenceNumber?.trim() || undefined, voucherNumber: input.voucherNumber?.trim() || undefined, lastFourDigits: input.lastFourDigits?.trim() || undefined, notes: input.notes?.trim() || undefined, creditExcessToStoreCredit: Boolean(input.excessToStoreCredit), idempotencyKey: key, ...(input.branchId ? { branchId: input.branchId } : {}) }; }

export function creditDisplayDate(value:string,timeZone:string){const day=creditCalendarDate(value,timeZone);if(!day)return 'Fecha no disponible';return new Intl.DateTimeFormat('es-PY',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'}).format(new Date(day+'T12:00:00Z'))}
