type PendingUpdateAttempt = {
  signature: string
  key: string
}

export interface UpdateSaveIdempotency {
  getKey(actionId: string, payload: unknown): string
  complete(actionId: string, key: string): void
  reject(actionId: string, key: string): void
}

export type UpdateSaveOutcome = 'success' | 'definitive-rejection' | 'uncertain'

export function classifyProductUpdateResponse(
  response: { ok: boolean; status: number },
  payload: { success?: boolean; data?: unknown } | null,
): UpdateSaveOutcome {
  const responseData = payload?.data
  const hasUpdatedProduct = Boolean(
    responseData && typeof responseData === 'object' && (
      'product' in responseData
        ? Boolean((responseData as { product?: unknown }).product)
        : true
    ),
  )

  if (response.ok && payload?.success && hasUpdatedProduct) return 'success'
  if (!response.ok && isDefinitiveUpdateRejection(response.status)) return 'definitive-rejection'
  return 'uncertain'
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, currentValue: unknown) => {
    if (currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
      const objectValue = currentValue as Record<string, unknown>
      return Object.fromEntries(
        Object.keys(objectValue)
          .sort()
          .map((key) => [key, objectValue[key]]),
      )
    }

    return currentValue
  }) ?? 'undefined'
}

/** Keeps one uncertain product update attempt available for a same-payload retry. */
export function createUpdateSaveIdempotency(
  createKey: () => string = () => globalThis.crypto.randomUUID(),
): UpdateSaveIdempotency {
  const pendingAttempts = new Map<string, PendingUpdateAttempt>()

  const settle = (actionId: string, key: string) => {
    if (pendingAttempts.get(actionId)?.key === key) {
      pendingAttempts.delete(actionId)
    }
  }

  return {
    getKey(actionId, payload) {
      const signature = stableJson(payload)
      const current = pendingAttempts.get(actionId)
      if (current?.signature === signature) return current.key

      const key = createKey()
      pendingAttempts.set(actionId, { signature, key })
      return key
    },
    complete: settle,
    reject: settle,
  }
}

/** 408/425/429 and server failures can follow an uncertain request outcome. */
export function isDefinitiveUpdateRejection(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 425 && status !== 429
}

/** Executes a save and clears its key only when the outcome is known. */
export async function executeUpdateSaveAttempt<T>(options: {
  attempts: UpdateSaveIdempotency
  actionId: string
  payload: unknown
  execute: (key: string) => Promise<T>
  classify: (result: T) => UpdateSaveOutcome
}): Promise<T> {
  const key = options.attempts.getKey(options.actionId, options.payload)
  const result = await options.execute(key)
  const outcome = options.classify(result)

  if (outcome === 'success') options.attempts.complete(options.actionId, key)
  if (outcome === 'definitive-rejection') options.attempts.reject(options.actionId, key)

  return result
}
