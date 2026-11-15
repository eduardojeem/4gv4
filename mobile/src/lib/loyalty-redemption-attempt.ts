export type RedemptionContext = { userId: string; organizationId: string }
export type PendingRedemption = {
  customerId: string
  customerName: string
  points: number
  key: string
}
export type RedemptionStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}
export const redemptionStorageKey = (context: RedemptionContext) =>
  'loyalty-redemption.' + context.userId + '.' + context.organizationId
export async function pendingRedemption(
  context: RedemptionContext,
  storage: RedemptionStorage,
): Promise<PendingRedemption | null> {
  const value = await storage.getItem(redemptionStorageKey(context))
  if (!value) return null
  const parsed = JSON.parse(value) as Partial<PendingRedemption>
  if (
    typeof parsed.customerId !== 'string' ||
    typeof parsed.customerName !== 'string' ||
    typeof parsed.key !== 'string' ||
    !Number.isInteger(parsed.points) ||
    Number(parsed.points) <= 0
  )
    throw new Error('No se pudo leer el canje pendiente. Revisá su historial antes de continuar.')
  return parsed as PendingRedemption
}
const flights = new Map<string, Promise<unknown>>()
export async function submitRedemption(
  context: RedemptionContext,
  request: { customerId: string; customerName: string; points: number },
  dependencies: {
    isCurrent?: () => boolean
    storage: RedemptionStorage
    submit: (customerId: string, points: number, key: string) => Promise<unknown>
  },
) {
  const assertCurrent = () => {
    if (dependencies.isCurrent && !dependencies.isCurrent())
      throw new Error('La sesión o el negocio cambió. Volvé a cargar el canje.')
  }
  assertCurrent()
  if (
    !context.userId ||
    !context.organizationId ||
    !Number.isInteger(request.points) ||
    request.points <= 0
  )
    throw new Error('Los datos del canje no son válidos.')
  const storageKey = redemptionStorageKey(context)
  if (flights.has(storageKey)) throw new Error('Ya hay un canje en curso. Esperá su confirmación.')
  const operation = (async () => {
    const existing = await pendingRedemption(context, dependencies.storage)
    assertCurrent()
    if (
      existing &&
      (existing.customerId !== request.customerId || existing.points !== request.points)
    )
      throw new Error(
        'Hay un canje pendiente para ' +
          existing.customerName +
          ' por ' +
          existing.points +
          ' puntos. Reintentá ese canje antes de iniciar otro.',
      )
    const attempt = existing ?? {
      ...request,
      key: 'loyalty-mobile-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    }
    await dependencies.storage.setItem(storageKey, JSON.stringify(attempt))
    assertCurrent()
    try {
      const result = await dependencies.submit(attempt.customerId, attempt.points, attempt.key)
      try { await dependencies.storage.removeItem(storageKey) } catch { /* El servidor ya confirmó el canje: un fallo de limpieza no lo convierte en un pago fallido. */ }
      return result
    } catch (error) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0
      if ([400, 401, 403, 404, 422].includes(status))
        await dependencies.storage.removeItem(storageKey)
      throw error
    }
  })()
  flights.set(storageKey, operation)
  try {
    return await operation
  } finally {
    if (flights.get(storageKey) === operation) flights.delete(storageKey)
  }
}
