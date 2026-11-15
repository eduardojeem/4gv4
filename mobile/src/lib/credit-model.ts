import type { CollectInput, InstallmentRow } from './customers';
import { creditCalendarDate,creditInstallmentIsOverdue } from '../../../src/lib/credits/calendar';
export const roundCreditMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function parseCreditAmount(raw: string): number { if (!/^\d{1,10}([.,]\d{1,2})?$/.test(raw.trim()))
    throw new Error('Ingresá el monto sin separadores de miles y con hasta dos decimales. Ejemplo: 100,50.'); const value = Number(raw.trim().replace(',', '.')); if (!Number.isFinite(value) || value <= 0 || value > 1000000000)
    throw new Error('El monto debe ser mayor a cero y estar dentro del límite permitido.'); return value; }
export const formatCreditAmountInput = (value: number) => { if (!Number.isFinite(value) || value < 0)
    throw new Error('El monto no es válido.'); return (Number.isInteger(roundCreditMoney(value)) ? String(roundCreditMoney(value)) : roundCreditMoney(value).toFixed(2)).replace('.', ','); };
export function formatCreditMoney(value: number, currency: string) { if (!Number.isFinite(value) || !currency || !/^[A-Z]{3}$/.test(currency))
    return 'No disponible'; return new Intl.NumberFormat('es-PY', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
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
export function creditCollectionPayload(input: CollectInput, key: string) { parseCreditAmount(String(input.amount)); for (const row of input.allocations ?? [])
    parseCreditAmount(String(row.amount)); return { amount: input.amount, paymentMethod: input.method, mode: input.allocations?.length ? 'manual' : 'auto', ...(input.allocations?.length ? { allocations: input.allocations.map(row => ({ ...row })) } : {}), referenceNumber: input.referenceNumber?.trim() || undefined, voucherNumber: input.voucherNumber?.trim() || undefined, lastFourDigits: input.lastFourDigits?.trim() || undefined, notes: input.notes?.trim() || undefined, creditExcessToStoreCredit: Boolean(input.excessToStoreCredit), idempotencyKey: key, ...(input.branchId ? { branchId: input.branchId } : {}) }; }

export function creditDisplayDate(value:string,timeZone:string){const day=creditCalendarDate(value,timeZone);if(!day)return 'Fecha no disponible';return new Intl.DateTimeFormat('es-PY',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'}).format(new Date(day+'T12:00:00Z'))}
