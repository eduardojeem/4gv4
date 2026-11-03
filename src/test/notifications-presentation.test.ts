import { resolveNotificationRoute } from '../lib/notifications/routes'
import { describe, expect, it } from 'vitest'
import { notificationGroup, notificationDateSection, isUrgentNotification, supportsCategoryChannels } from '../lib/notifications/presentation'
describe('presentación de notificaciones', () => {
  it('abre ventas exactas y evita el detalle inexistente de créditos', () => {
    expect(resolveNotificationRoute({ type: 'SALE_CREATED', resourceId: 'sale-12' })).toBe('/panel/sales/sale-12')
    expect(resolveNotificationRoute({ type: 'PAYMENT_FAILED', resourceId: 'payment-12' })).toBe('/panel/credits')
  })
  it('clasifica los eventos cuyo prefijo difiere de su categoría', () => {
    expect(notificationGroup('NEW_ONLINE_ORDER')).toBe('orders')
    expect(notificationGroup('LARGE_SALE')).toBe('sales')
    expect(notificationGroup('FUTURE_EVENT')).toBe('system')
  })
  it('separa días por calendario local', () => {
    const now = new Date(2026, 10, 5, 0, 5)
    expect(notificationDateSection(new Date(2026, 10, 4, 23, 59).toISOString(), now)).toBe('Ayer')
    expect(notificationDateSection(new Date(2026, 10, 2, 12).toISOString(), now)).toBe('Esta semana')
  })
  it('solo usa canales nuevos con versiones compatibles', () => {
    expect(supportsCategoryChannels('1.0.0')).toBe(false)
    expect(supportsCategoryChannels(null)).toBe(false)
    expect(supportsCategoryChannels('1.1.0')).toBe(true)
    expect(supportsCategoryChannels('2.0.0')).toBe(true)
  })
  it('distingue urgencia de actividad normal', () => {
    expect(isUrgentNotification('SALE_CREATED')).toBe(false)
    expect(isUrgentNotification('CASH_DIFFERENCE')).toBe(true)
  })
})