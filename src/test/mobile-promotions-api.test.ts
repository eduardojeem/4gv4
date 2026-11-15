import { beforeEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('../../mobile/src/lib/api', () => ({
  apiFetch: api.call,
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public body: Record<string, unknown> | null = null,
    ) {
      super(message)
    }
  },
}))
import {
  fetchPromotions,
  savePromotion,
  savePointRule,
  fetchRaffleDetail,
  redeemLoyalty,
  drawRaffle,
  promotionsError,
} from '../../mobile/src/lib/promotions'
import { ApiError } from '../../mobile/src/lib/api'
import {
  buildPromotion,
  promotionDraft,
  buildPointRule,
  pointRuleDraft,
} from '../../mobile/src/lib/promotions-model'
beforeEach(() => api.call.mockReset())
it('pagina y codifica la búsqueda sin descargar todas las promociones', async () => {
  await fetchPromotions(2, 'corte & barba')
  expect(api.call).toHaveBeenCalledWith('/api/promotions?limit=25&page=2&q=corte%20%26%20barba')
})
it('crea descuentos mediante la API compartida, sin enviar organización ni usos manipulados', async () => {
  const body = buildPromotion({ ...promotionDraft(), name: 'Corte', code: 'C10' })
  await savePromotion(body)
  const [url, options] = api.call.mock.calls[0]
  expect(url).toBe('/api/promotions')
  const payload = JSON.parse(options.body)
  expect(payload).not.toHaveProperty('organization_id')
  expect(payload).not.toHaveProperty('usage_count')
})
it('conserva el tipo de una campaña existente al editarla', async () => {
  await savePointRule(buildPointRule({ ...pointRuleDraft(), name: 'Doble' }), 'rule-one')
  const [url, options] = api.call.mock.calls[0]
  expect(url).toBe('/api/loyalty/rules/rule-one')
  expect(options.method).toBe('PATCH')
  expect(JSON.parse(options.body)).not.toHaveProperty('kind')
})
it('pagina números emitidos y deja sortear exclusivamente al servidor', async () => {
  await fetchRaffleDetail('raffle-one', 3)
  expect(api.call).toHaveBeenCalledWith('/api/raffles/raffle-one?page=3&limit=25')
  await drawRaffle('raffle-one')
  expect(api.call).toHaveBeenLastCalledWith('/api/raffles/raffle-one/draw', {
    method: 'POST',
    body: '{}',
  })
})
it('envía la misma clave de canje recibida del registro de intentos', async () => {
  await redeemLoyalty('customer-one', 10, 'same-reference')
  expect(api.call).toHaveBeenCalledWith('/api/loyalty/customers/customer-one/redeem', {
    method: 'POST',
    body: JSON.stringify({ points: 10, idempotencyKey: 'same-reference' }),
  })
})
it('traduce estados de plan y módulo en instrucciones útiles, sin inventar datos vacíos', () => {
  expect(
    promotionsError(new ApiError('Module disabled', 403, { code: 'MODULE_DISABLED' })),
  ).toContain('Rubro y herramientas')
  expect(
    promotionsError(new ApiError('Module unavailable', 402, { code: 'MODULE_NOT_ENTITLED' })),
  ).toContain('Suscripciones')
})
