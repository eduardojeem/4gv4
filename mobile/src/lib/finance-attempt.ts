export type FinanceAttemptContext = { userId: string; organizationId: string };
/** expense: gasto nuevo · payment: pago de un gasto · payroll_payment: pago de un sueldo liquidado. */
export type FinanceAttempt = { kind: 'expense' | 'payment' | 'payroll_payment'; targetId?: string; payload: Record<string, unknown> };
export type PendingFinanceAttempt = FinanceAttempt & { context: FinanceAttemptContext; idempotencyKey: string };
type Storage = { getItem(key: string): string | null | Promise<string | null>; setItem(key: string, value: string): void | Promise<void>; removeItem(key: string): void | Promise<void> };
const keyFor = (context: FinanceAttemptContext) => `finance-attempt-v1.${context.userId}.${context.organizationId}`;
const fingerprint = (attempt: FinanceAttempt) => JSON.stringify([attempt.kind, attempt.targetId, attempt.payload]);
const inFlight = new Map<string, { fingerprint: string; promise: Promise<unknown> }>();
export async function readPendingFinanceAttempt(context: FinanceAttemptContext, storage: Storage): Promise<PendingFinanceAttempt | null> {
  const raw = await storage.getItem(keyFor(context));
  if (!raw) return null;
  let row: PendingFinanceAttempt;
  try { row = JSON.parse(raw); } catch { throw new Error('No se puede leer la operación pendiente. Revisá Finanzas antes de registrar otra.'); }
  if (row.context?.userId !== context.userId || row.context?.organizationId !== context.organizationId || !['expense', 'payment', 'payroll_payment'].includes(row.kind) || typeof row.idempotencyKey !== 'string' || !row.payload || typeof row.payload !== 'object') throw new Error('No se puede validar la operación pendiente. Contactá con soporte antes de repetirla.');
  return row;
}
/** Persist before sending; uncertainty always keeps the same immutable operation and key. */
export async function submitFinanceAttempt<T>(context: FinanceAttemptContext, input: FinanceAttempt, storage: Storage, send: (input: FinanceAttempt, key: string) => Promise<T>): Promise<T> {
  if (!context.userId || !context.organizationId) throw new Error('Esperá a que se valide la empresa activa.');
  const key = keyFor(context), signature = fingerprint(input);
  const running = inFlight.get(key);
  if (running) {
    if (running.fingerprint !== signature) throw new Error('Hay una operación pendiente. Esperá su resultado.');
    return running.promise as Promise<T>;
  }
  const task = (async () => {
    const pending = await readPendingFinanceAttempt(context, storage);
    if (pending && fingerprint(pending) !== signature) throw new Error('Hay una operación pendiente. Recuperá su resultado antes de cambiar los datos.');
    const attempt: PendingFinanceAttempt = pending ?? { ...input, context, idempotencyKey: `mobile-finance-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,14)}` };
    if (!pending) await storage.setItem(key, JSON.stringify(attempt));
    try {
      const result = await send(attempt, attempt.idempotencyKey);
      await storage.removeItem(key);
      return result;
    } catch (error) {
      const status = error instanceof Error ? (error as Error & { status?: number }).status : undefined;
      if (status && [400, 401, 403, 404, 422].includes(status)) await storage.removeItem(key);
      throw error;
    }
  })();
  inFlight.set(key, { fingerprint: signature, promise: task });
  try { return await task; } finally { if (inFlight.get(key)?.promise === task) inFlight.delete(key); }
}