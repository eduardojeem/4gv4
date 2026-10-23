import type { CollectInput, CollectResult } from './customers';

export type CollectionAttemptContext = Readonly<{
  userId: string;
  organizationId: string;
  branchId: string | null;
  customerId: string;
}>;

export type PendingMobileCollection = Readonly<{
  context: CollectionAttemptContext;
  input: CollectInput;
  idempotencyKey: string;
  createdAt: string;
}>;

export type CollectionStorage = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
};
type Dependencies = { storage: CollectionStorage; collect: (customerId: string, input: CollectInput, key: string) => Promise<CollectResult> };

export class MobileCollectionAttemptError extends Error {
  constructor(message: string, public readonly uncertain = false, public readonly status?: number, public readonly code?: string) {
    super(message);
    this.name = 'MobileCollectionAttemptError';
  }
}

type HttpCollectionError = Error & { status: number; body: Record<string, unknown> | null }
function isHttpCollectionError(error: unknown): error is HttpCollectionError {
  return error instanceof Error && typeof (error as { status?: unknown }).status === 'number'
}

function isDefinitiveRejection(error: unknown): error is HttpCollectionError {
  if (!isHttpCollectionError(error)) return false;
  if ([400, 401, 403, 404, 422].includes(error.status)) return true;
  if (error.status !== 409) return false;
  const code = error.body?.code;
  return code === 'COLLECTION_BALANCE_CHANGED' || code === 'COLLECTION_CASH_CLOSED';
}

const storageKey = (context: CollectionAttemptContext) =>
  `mobile-credit-collection:v1:${context.userId}:${context.organizationId}`;
const tenantIdentityMatches = (left: CollectionAttemptContext, right: CollectionAttemptContext) =>
  left.userId === right.userId && left.organizationId === right.organizationId;
const payloadFingerprint = (input: CollectInput) => JSON.stringify(input);
const inFlight = new Map<string, { fingerprint: string; promise: Promise<CollectResult> }>();

function isPending(value: unknown): value is PendingMobileCollection {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<PendingMobileCollection>;
  const context = row.context;
  const input = row.input;
  return Boolean(
    context && typeof context.userId === 'string' && typeof context.organizationId === 'string' &&
    typeof context.customerId === 'string' && (context.branchId === null || typeof context.branchId === 'string') &&
    input && typeof input.amount === 'number' && ['cash', 'card', 'transfer'].includes(input.method) &&
    typeof row.idempotencyKey === 'string' && row.idempotencyKey.length >= 8 && typeof row.createdAt === 'string'
  );
}

export async function getPendingMobileCollection(storage: CollectionStorage, context: CollectionAttemptContext): Promise<PendingMobileCollection | null> {
  const raw = await storage.getItem(storageKey(context));
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MobileCollectionAttemptError('El cobro pendiente no se puede leer. Revisá la cartera antes de iniciar otro cobro.', true);
  }
  if (!isPending(parsed) || !tenantIdentityMatches(parsed.context, context)) {
    throw new MobileCollectionAttemptError('El cobro pendiente no se puede validar. Revisá la cartera antes de continuar.', true);
  }
  if (parsed.context.customerId !== context.customerId || parsed.context.branchId !== context.branchId) {
    throw new MobileCollectionAttemptError('Hay un cobro pendiente de otra sucursal o cliente. Volvé a ese contexto para recuperar su resultado antes de cobrar de nuevo.', true);
  }
  return parsed;
}

async function send(context: CollectionAttemptContext, input: CollectInput, dependencies: Dependencies) {
  if (!context.userId || !context.organizationId || !context.customerId) {
    throw new MobileCollectionAttemptError('Esperá a que se valide el usuario, la organización y el cliente antes de cobrar.', false);
  }
  if (input.branchId && input.branchId !== context.branchId) {
    throw new MobileCollectionAttemptError('La sucursal del cobro no coincide con el contexto activo. Volvé a cargar el cobro antes de continuar.', false);
  }
  const key = storageKey(context);
  const fingerprint = payloadFingerprint(input);
  const active = inFlight.get(key);
  if (active) {
    if (active.fingerprint !== fingerprint) {
      throw new MobileCollectionAttemptError('Hay un cobro en curso. Esperá su resultado antes de cambiar el monto o iniciar otro.', true);
    }
    return active.promise;
  }

  const promise = (async () => {
    const pending = await getPendingMobileCollection(dependencies.storage, context);
    if (pending && payloadFingerprint(pending.input) !== fingerprint) {
      throw new MobileCollectionAttemptError('Hay un cobro pendiente de confirmar. Recuperalo antes de cambiar el monto o iniciar otro.', true);
    }
    const attempt: PendingMobileCollection = pending ?? {
      context,
      input,
      idempotencyKey: `app-collect-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
      createdAt: new Date().toISOString(),
    };
    if (!pending) {
      try {
        // Persist before the first request: the process may exit after the server commits.
        await dependencies.storage.setItem(key, JSON.stringify(attempt));
      } catch {
        throw new MobileCollectionAttemptError('No se pudo guardar el intento de cobro de forma segura. No se envió el pago.', false);
      }
    }
    try {
      const result = await dependencies.collect(context.customerId, attempt.input, attempt.idempotencyKey);
      await dependencies.storage.removeItem(key);
      return result;
    } catch (error) {
      // Recovery stays uncertain because the original request may have committed.
      if (error instanceof MobileCollectionAttemptError) throw error;
      const definitive = !pending && isDefinitiveRejection(error);
      if (definitive) await dependencies.storage.removeItem(key);
      const apiError = isHttpCollectionError(error) ? error : null;
      const code = apiError?.body?.code;
      throw new MobileCollectionAttemptError(
        error instanceof Error ? error.message : 'No se pudo confirmar el cobro.',
        !definitive,
        apiError?.status,
        typeof code === 'string' ? code : undefined,
      );
    }
  })();
  inFlight.set(key, { fingerprint, promise });
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

export function submitMobileCollection(context: CollectionAttemptContext, input: CollectInput, dependencies: Dependencies) {
  return send(context, input, dependencies);
}

export async function retryMobileCollection(storage: CollectionStorage, context: CollectionAttemptContext, dependencies: Dependencies) {
  const pending = await getPendingMobileCollection(storage, context);
  if (!pending) throw new MobileCollectionAttemptError('No hay un cobro pendiente de recuperar.', false);
  return send(context, pending.input, dependencies);
}
