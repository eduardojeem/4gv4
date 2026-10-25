import { describe, expect, it, vi } from 'vitest'

import {
  classifyProductUpdateResponse,
  createUpdateSaveIdempotency,
  executeUpdateSaveAttempt,
  isDefinitiveUpdateRejection,
} from '@/lib/products/update-save-idempotency'

describe('update save idempotency', () => {
  it('assigns a key to the first logical save attempt', () => {
    const createKey = vi.fn().mockReturnValue('K1')
    const attempts = createUpdateSaveIdempotency(createKey)

    expect(attempts.getKey('org:branch:product', { name: 'Phone' })).toBe('K1')
    expect(createKey).toHaveBeenCalledTimes(1)
  })

  it('reuses the same key when an uncertain save with the same payload is retried', () => {
    const createKey = vi.fn().mockReturnValue('K1')
    const attempts = createUpdateSaveIdempotency(createKey)
    const payload = { variants: [{ id: 'v1', stockQuantity: 10 }], name: 'Phone' }
    const sentKeys: string[] = []

    return executeUpdateSaveAttempt({
      attempts,
      actionId: 'org:branch:product',
      payload,
      execute: async (key) => {
        sentKeys.push(key)
        throw new TypeError('Failed to fetch')
      },
      classify: () => 'uncertain',
    }).catch(() => executeUpdateSaveAttempt({
      attempts,
      actionId: 'org:branch:product',
      payload: { name: 'Phone', variants: [{ stockQuantity: 10, id: 'v1' }] },
      execute: async (key) => {
        sentKeys.push(key)
        return { status: 200 }
      },
      classify: () => classifyProductUpdateResponse({ ok: true, status: 200 }, { success: true, data: { product: { id: 'p1' } } }),
    })).then(() => {
      expect(sentKeys).toEqual(['K1', 'K1'])
      expect(createKey).toHaveBeenCalledTimes(1)
    })
  })

  it('uses a new key for a new save after the previous save succeeded', async () => {
    const createKey = vi.fn().mockReturnValueOnce('K1').mockReturnValueOnce('K2')
    const attempts = createUpdateSaveIdempotency(createKey)
    const payload = { name: 'Phone' }

    await executeUpdateSaveAttempt({
      attempts,
      actionId: 'org:branch:product',
      payload,
      execute: async () => ({ ok: true, status: 200, payload: { success: true, data: { product: { id: 'p1' } } } }),
      classify: ({ ok, status, payload: responsePayload }) => classifyProductUpdateResponse({ ok, status }, responsePayload),
    })

    await executeUpdateSaveAttempt({
      attempts,
      actionId: 'org:branch:product',
      payload,
      execute: async (key) => ({ key, ok: true, status: 200, payload: { success: true, data: { product: { id: 'p1' } } } }),
      classify: ({ ok, status, payload: responsePayload }) => classifyProductUpdateResponse({ ok, status }, responsePayload),
    })
    expect(createKey).toHaveBeenCalledTimes(2)
  })

  it('releases a key after a definitive server rejection', async () => {
    const createKey = vi.fn().mockReturnValueOnce('K1').mockReturnValueOnce('K2')
    const attempts = createUpdateSaveIdempotency(createKey)
    const payload = { sku: 'duplicate' }

    await executeUpdateSaveAttempt({
      attempts,
      actionId: 'org:branch:product',
      payload,
      execute: async () => ({ ok: false, status: 409, payload: { success: false } }),
      classify: ({ ok, status, payload: responsePayload }) => classifyProductUpdateResponse({ ok, status }, responsePayload),
    })

    expect(attempts.getKey('org:branch:product', payload)).toBe('K2')
  })

  it('keeps the key available after a timeout or lost network response', async () => {
    const createKey = vi.fn().mockReturnValue('K1')
    const attempts = createUpdateSaveIdempotency(createKey)
    const payload = { variants: [{ id: 'v1', stockQuantity: 10 }] }
    const sentKeys: string[] = []

    await expect(executeUpdateSaveAttempt({
      attempts,
      actionId: 'org:branch:product',
      payload,
      execute: async (key) => {
        sentKeys.push(key)
        throw new DOMException('Request timed out', 'AbortError')
      },
      classify: () => 'uncertain',
    })).rejects.toThrow('Request timed out')

    await executeUpdateSaveAttempt({
      attempts,
      actionId: 'org:branch:product',
      payload,
      execute: async (key) => {
        sentKeys.push(key)
        return { ok: true, status: 200, payload: { success: true, data: { product: { id: 'p1' } } } }
      },
      classify: ({ ok, status, payload: responsePayload }) => classifyProductUpdateResponse({ ok, status }, responsePayload),
    })

    expect(sentKeys).toEqual(['K1', 'K1'])
  })

  it('does not reuse a key for a different save action or payload', () => {
    const createKey = vi.fn().mockReturnValueOnce('K1').mockReturnValueOnce('K2').mockReturnValueOnce('K3')
    const attempts = createUpdateSaveIdempotency(createKey)

    expect(attempts.getKey('org:branch:product-a', { name: 'Phone' })).toBe('K1')
    expect(attempts.getKey('org:branch:product-a', { name: 'Phone 2' })).toBe('K2')
    expect(attempts.getKey('org:branch:product-b', { name: 'Phone' })).toBe('K3')
  })

  it('does not let an older response clear a newer pending attempt', () => {
    const createKey = vi.fn().mockReturnValueOnce('K1').mockReturnValueOnce('K2')
    const attempts = createUpdateSaveIdempotency(createKey)
    const firstKey = attempts.getKey('org:branch:product', { name: 'First' })
    const secondKey = attempts.getKey('org:branch:product', { name: 'Second' })

    attempts.complete('org:branch:product', firstKey)

    expect(attempts.getKey('org:branch:product', { name: 'Second' })).toBe(secondKey)
  })

  it('treats explicit client errors as definitive, but keeps timeout/rate-limit/server errors retryable', () => {
    expect(isDefinitiveUpdateRejection(400)).toBe(true)
    expect(isDefinitiveUpdateRejection(409)).toBe(true)
    expect(isDefinitiveUpdateRejection(408)).toBe(false)
    expect(isDefinitiveUpdateRejection(425)).toBe(false)
    expect(isDefinitiveUpdateRejection(429)).toBe(false)
    expect(isDefinitiveUpdateRejection(500)).toBe(false)
    expect(classifyProductUpdateResponse({ ok: false, status: 400 }, { success: false })).toBe('definitive-rejection')
    expect(classifyProductUpdateResponse({ ok: false, status: 408 }, { success: false })).toBe('uncertain')
    expect(classifyProductUpdateResponse({ ok: true, status: 200 }, { success: true, data: { product: { id: 'p1' } } })).toBe('success')
    expect(classifyProductUpdateResponse({ ok: true, status: 200 }, null)).toBe('uncertain')
  })
})
