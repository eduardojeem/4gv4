import { describe, expect, it } from 'vitest';

import {
  getPendingMobileCollection,
  MobileCollectionAttemptError,
  retryMobileCollection,
  submitMobileCollection,
  type CollectionAttemptContext,
  type CollectionStorage,
} from '../../mobile/src/lib/credit-collection-attempt';
import type { CollectInput, CollectResult } from '../../mobile/src/lib/customers';

class MemoryStorage implements CollectionStorage {
  private values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return Promise.resolve(this.values.get(key) ?? null); }
  setItem(key: string, value: string) { this.writes++; this.values.set(key, value); return Promise.resolve(); }
  removeItem(key: string) { this.values.delete(key); return Promise.resolve(); }
}

const context: CollectionAttemptContext = {
  userId: 'user-a', organizationId: 'org-a', branchId: 'branch-a', customerId: 'customer-a',
};
const input: CollectInput = { amount: 120_000, method: 'transfer', referenceNumber: 'TRX-123', branchId: 'branch-a' };
const result: CollectResult = { receiptNumber: 'REC-1', totalApplied: 120_000, excessToStoreCredit: 0, appliedAllocations: [] };

describe('mobile credit collection attempt persistence', () => {
  it('clears a confirmed collection after success', async () => {
    const storage = new MemoryStorage();
    const collect = async () => result;

    await submitMobileCollection(context, input, { storage, collect });

    expect(await getPendingMobileCollection(storage, context)).toBeNull();
  });

  it('retries the same idempotency key after the server processed a request but its response was lost', async () => {
    const storage = new MemoryStorage();
    const keys: string[] = [];
    const processedKeys = new Set<string>();
    let committed = 0;
    let firstResponse = true;
    const collect = async (_customerId: string, _input: CollectInput, key: string) => {
      keys.push(key);
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        committed++;
      }
      if (firstResponse) {
        firstResponse = false;
        throw new Error('network timeout after commit');
      }
      return result;
    };

    await expect(submitMobileCollection(context, input, { storage, collect })).rejects.toThrow('network timeout after commit');
    const saved = await getPendingMobileCollection(storage, context);
    expect(saved?.input).toEqual(input);
    expect(await retryMobileCollection(storage, context, { storage, collect })).toEqual(result);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(committed).toBe(1);
    expect(storage.writes).toBe(1);
    expect(await getPendingMobileCollection(storage, context)).toBeNull();
  });

  it('keeps the attempt after a timeout and recovers it after an app restart/remount', async () => {
    const storage = new MemoryStorage();
    await expect(submitMobileCollection(context, input, { storage, collect: async () => { throw new Error('timeout'); } })).rejects.toThrow('timeout');

    const remountedStorageAdapter = storage;
    const pending = await getPendingMobileCollection(remountedStorageAdapter, context);
    expect(pending?.context).toEqual(context);
    await retryMobileCollection(remountedStorageAdapter, context, { storage: remountedStorageAdapter, collect: async () => result });
  });

  it('does not expose or reuse a pending attempt for another organization or user', async () => {
    const storage = new MemoryStorage();
    await expect(submitMobileCollection(context, input, { storage, collect: async () => { throw new Error('timeout'); } })).rejects.toThrow('timeout');

    expect(await getPendingMobileCollection(storage, { ...context, organizationId: 'org-b' })).toBeNull();
    expect(await getPendingMobileCollection(storage, { ...context, userId: 'user-b' })).toBeNull();
    await expect(retryMobileCollection(storage, { ...context, organizationId: 'org-b' }, { storage, collect: async () => result })).rejects.toBeInstanceOf(MobileCollectionAttemptError);
  });

  it('blocks a retry from a different branch without overwriting the original attempt', async () => {
    const storage = new MemoryStorage();
    await expect(submitMobileCollection(context, input, { storage, collect: async () => { throw new Error('timeout'); } })).rejects.toThrow('timeout');

    await expect(getPendingMobileCollection(storage, { ...context, branchId: 'branch-b' })).rejects.toBeInstanceOf(MobileCollectionAttemptError);
    expect((await getPendingMobileCollection(storage, context))?.input).toEqual(input);
  });

  it('blocks a new customer in the same organization until the prior attempt is resolved', async () => {
    const storage = new MemoryStorage();
    await expect(submitMobileCollection(context, input, { storage, collect: async () => { throw new Error('timeout'); } })).rejects.toThrow('timeout');

    await expect(submitMobileCollection({ ...context, customerId: 'customer-b' }, input, { storage, collect: async () => result }))
      .rejects.toBeInstanceOf(MobileCollectionAttemptError);
    expect((await getPendingMobileCollection(storage, context))?.context.customerId).toBe(context.customerId);
  });

  it('rejects a different payload while an uncertain attempt is pending', async () => {
    const storage = new MemoryStorage();
    await expect(submitMobileCollection(context, input, { storage, collect: async () => { throw new Error('timeout'); } })).rejects.toThrow('timeout');

    await expect(submitMobileCollection(context, { ...input, amount: 121_000 }, { storage, collect: async () => result })).rejects.toMatchObject({ name: 'MobileCollectionAttemptError' });
  });

  it('coalesces a double tap into one request and blocks a simultaneous different payment', async () => {
    const storage = new MemoryStorage();
    let resolve!: (value: CollectResult) => void;
    const collect = () => new Promise<CollectResult>((done) => { resolve = done; });
    const first = submitMobileCollection(context, input, { storage, collect });
    const second = submitMobileCollection(context, input, { storage, collect });
    await Promise.resolve();
    await expect(submitMobileCollection(context, { ...input, amount: 130_000 }, { storage, collect })).rejects.toBeInstanceOf(MobileCollectionAttemptError);
    resolve(result);
    await expect(Promise.all([first, second])).resolves.toEqual([result, result]);
  });

  it.each([
    [400, 'COLLECTION_INVALID_REQUEST'],
    [401, 'AUTH_REQUIRED'],
    [403, 'COLLECTION_FORBIDDEN'],
    [404, 'COLLECTION_CUSTOMER_NOT_FOUND'],
    [422, 'COLLECTION_EXCESS_CONFIRMATION'],
    [409, 'COLLECTION_BALANCE_CHANGED'],
    [409, 'COLLECTION_CASH_CLOSED'],
  ])('clears a definitive HTTP rejection (%s / %s) so a corrected collection can start', async (status, code) => {
    const storage = new MemoryStorage();
    const rejected = async () => { throw Object.assign(new Error('Rechazo confirmado'), { status, body: { code } }); };
    await expect(submitMobileCollection(context, input, { storage, collect: rejected }))
      .rejects.toMatchObject({ uncertain: false, status, code });
    expect(await getPendingMobileCollection(storage, context)).toBeNull();
    await expect(submitMobileCollection(context, { ...input, amount: input.amount - 1000 }, { storage, collect: async () => result }))
      .resolves.toEqual(result);
  });

  it('keeps idempotency conflicts and transport failures uncertain', async () => {
    for (const error of [
      Object.assign(new Error('Resultado previo incierto'), { status: 409, body: { code: 'COLLECTION_IDEMPOTENCY_CONFLICT' } }),
      Object.assign(new Error('No se pudo conectar'), { status: 0, body: null }),
      Object.assign(new Error('Error del servidor'), { status: 500, body: { code: 'COLLECTION_FAILED' } }),
    ]) {
      const storage = new MemoryStorage();
      await expect(submitMobileCollection(context, input, { storage, collect: async () => { throw error; } }))
        .rejects.toMatchObject({ uncertain: true });
      expect(await getPendingMobileCollection(storage, context)).not.toBeNull();
    }
  });

  it('keeps a prior uncertain attempt when a recovery request is definitively rejected', async () => {
    const storage = new MemoryStorage();
    const networkDrop = async () => { throw Object.assign(new Error('Conexión perdida'), { status: 0, body: null }); };
    await expect(submitMobileCollection(context, input, { storage, collect: networkDrop })).rejects.toMatchObject({ uncertain: true });
    const saved = await getPendingMobileCollection(storage, context);
    await expect(retryMobileCollection(storage, context, { storage, collect: async () => { throw Object.assign(new Error('Sin permiso'), { status: 403, body: { code: 'COLLECTION_FORBIDDEN' } }); } }))
      .rejects.toMatchObject({ uncertain: true });
    expect(await getPendingMobileCollection(storage, context)).toEqual(saved);
  });
});
