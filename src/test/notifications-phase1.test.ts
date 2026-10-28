import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_METADATA,
  NOTIFICATION_TYPES,
} from '@/lib/notifications/types'
import { buildNotificationIdempotencyKey } from '@/lib/notifications/idempotency'
import {
  resolveCategoryDefault,
  resolveNotificationDefaultPreference,
} from '@/lib/notifications/defaults'

describe('Notifications Phase 1 - Type Catalog and Metadata', () => {
  it('defines all required notification types without duplicates', () => {
    expect(NOTIFICATION_TYPES.length).toBeGreaterThanOrEqual(40)
    const unique = new Set(NOTIFICATION_TYPES)
    expect(unique.size).toBe(NOTIFICATION_TYPES.length)

    // Ventas
    expect(NOTIFICATION_TYPES).toContain('SALE_CREATED')
    expect(NOTIFICATION_TYPES).toContain('SALE_VOIDED')
    expect(NOTIFICATION_TYPES).toContain('SALE_RETURNED')
    expect(NOTIFICATION_TYPES).toContain('LARGE_SALE')

    // Pedidos
    expect(NOTIFICATION_TYPES).toContain('ORDER_CREATED')
    expect(NOTIFICATION_TYPES).toContain('ORDER_CONFIRMED')
    expect(NOTIFICATION_TYPES).toContain('ORDER_READY')
    expect(NOTIFICATION_TYPES).toContain('ORDER_CANCELLED')
    expect(NOTIFICATION_TYPES).toContain('ORDER_OVERDUE')
    expect(NOTIFICATION_TYPES).toContain('NEW_ONLINE_ORDER')

    // Reparaciones
    expect(NOTIFICATION_TYPES).toContain('REPAIR_CREATED')
    expect(NOTIFICATION_TYPES).toContain('REPAIR_ASSIGNED')
    expect(NOTIFICATION_TYPES).toContain('REPAIR_STATUS_CHANGED')
    expect(NOTIFICATION_TYPES).toContain('REPAIR_READY')
    expect(NOTIFICATION_TYPES).toContain('REPAIR_OVERDUE')
    expect(NOTIFICATION_TYPES).toContain('REPAIR_NOTE_ADDED')

    // Servicios / Agenda
    expect(NOTIFICATION_TYPES).toContain('BOOKING_CREATED')
    expect(NOTIFICATION_TYPES).toContain('BOOKING_CONFIRMED')
    expect(NOTIFICATION_TYPES).toContain('BOOKING_CANCELLED')
    expect(NOTIFICATION_TYPES).toContain('BOOKING_RESCHEDULED')
    expect(NOTIFICATION_TYPES).toContain('BOOKING_REMINDER')
    expect(NOTIFICATION_TYPES).toContain('BOOKING_NO_SHOW')

    // Inventario
    expect(NOTIFICATION_TYPES).toContain('LOW_STOCK')
    expect(NOTIFICATION_TYPES).toContain('OUT_OF_STOCK')
    expect(NOTIFICATION_TYPES).toContain('VARIANT_LOW_STOCK')
    expect(NOTIFICATION_TYPES).toContain('STOCK_ADJUSTMENT')

    // Caja
    expect(NOTIFICATION_TYPES).toContain('CASH_REGISTER_OPENED')
    expect(NOTIFICATION_TYPES).toContain('CASH_REGISTER_CLOSED')
    expect(NOTIFICATION_TYPES).toContain('CASH_DIFFERENCE')

    // Créditos
    expect(NOTIFICATION_TYPES).toContain('CREDIT_PAYMENT_DUE')
    expect(NOTIFICATION_TYPES).toContain('CREDIT_OVERDUE')
    expect(NOTIFICATION_TYPES).toContain('PAYMENT_RECEIVED')
    expect(NOTIFICATION_TYPES).toContain('PAYMENT_FAILED')

    // Proveedores
    expect(NOTIFICATION_TYPES).toContain('PURCHASE_ORDER_RECEIVED')
    expect(NOTIFICATION_TYPES).toContain('PURCHASE_ORDER_DELAYED')
    expect(NOTIFICATION_TYPES).toContain('SUPPLIER_ORDER_STATUS_CHANGED')

    // Empleados y Seguridad
    expect(NOTIFICATION_TYPES).toContain('EMPLOYEE_INVITED')
    expect(NOTIFICATION_TYPES).toContain('ROLE_CHANGED')
    expect(NOTIFICATION_TYPES).toContain('PERMISSION_CHANGED')
    expect(NOTIFICATION_TYPES).toContain('NEW_LOGIN')
    expect(NOTIFICATION_TYPES).toContain('PASSWORD_CHANGED')

    // SaaS
    expect(NOTIFICATION_TYPES).toContain('SUBSCRIPTION_EXPIRING')
    expect(NOTIFICATION_TYPES).toContain('SUBSCRIPTION_PAYMENT_FAILED')
    expect(NOTIFICATION_TYPES).toContain('PLAN_CHANGED')
    expect(NOTIFICATION_TYPES).toContain('IMPORTANT_SYSTEM_MESSAGE')
  })

  it('provides complete metadata for every registered notification type', () => {
    for (const type of NOTIFICATION_TYPES) {
      const meta = NOTIFICATION_METADATA[type]
      expect(meta, `Metadata for ${type} must be defined`).toBeDefined()
      expect(meta.type).toBe(type)
      expect(typeof meta.title).toBe('string')
      expect(meta.title.trim().length).toBeGreaterThan(0)
      expect(NOTIFICATION_CATEGORIES).toContain(meta.category)
      expect(typeof meta.personal).toBe('boolean')
      expect(typeof meta.supportsBranchScope).toBe('boolean')
      expect(typeof meta.defaultPush).toBe('boolean')
      expect(typeof meta.defaultInApp).toBe('boolean')
      expect(['assigned_user', 'role_permission', 'branch_members', 'all_members']).toContain(meta.target)
    }
  })

  it('correctly maps required modules for business events', () => {
    expect(NOTIFICATION_METADATA.SALE_CREATED.requiredModule).toBe('pos')
    expect(NOTIFICATION_METADATA.ORDER_CREATED.requiredModule).toBe('orders')
    expect(NOTIFICATION_METADATA.NEW_ONLINE_ORDER.requiredModule).toBe('ecommerce')
    expect(NOTIFICATION_METADATA.REPAIR_ASSIGNED.requiredModule).toBe('repairs')
    expect(NOTIFICATION_METADATA.BOOKING_CREATED.requiredModule).toBe('services')
    expect(NOTIFICATION_METADATA.LOW_STOCK.requiredModule).toBe('inventory')
    expect(NOTIFICATION_METADATA.STOCK_ADJUSTMENT.requiredModule).toBe('inventory_admin')
    expect(NOTIFICATION_METADATA.CASH_DIFFERENCE.requiredModule).toBe('pos')
    expect(NOTIFICATION_METADATA.CREDIT_OVERDUE.requiredModule).toBe('credits')

    // Eventos administrativos universales no dependen de módulos operacionales específicos
    expect(NOTIFICATION_METADATA.EMPLOYEE_INVITED.requiredModule).toBeNull()
    expect(NOTIFICATION_METADATA.NEW_LOGIN.requiredModule).toBeNull()
    expect(NOTIFICATION_METADATA.SUBSCRIPTION_EXPIRING.requiredModule).toBeNull()
  })

  it('correctly marks personal targeted notifications', () => {
    expect(NOTIFICATION_METADATA.REPAIR_ASSIGNED.personal).toBe(true)
    expect(NOTIFICATION_METADATA.REPAIR_ASSIGNED.target).toBe('assigned_user')

    expect(NOTIFICATION_METADATA.REPAIR_NOTE_ADDED.personal).toBe(true)
    expect(NOTIFICATION_METADATA.BOOKING_REMINDER.personal).toBe(true)
    expect(NOTIFICATION_METADATA.ROLE_CHANGED.personal).toBe(true)
    expect(NOTIFICATION_METADATA.PERMISSION_CHANGED.personal).toBe(true)
    expect(NOTIFICATION_METADATA.NEW_LOGIN.personal).toBe(true)

    // Ventas e inventario no son personales
    expect(NOTIFICATION_METADATA.SALE_CREATED.personal).toBe(false)
    expect(NOTIFICATION_METADATA.LOW_STOCK.personal).toBe(false)
  })

  it('maps required permissions appropriately', () => {
    expect(NOTIFICATION_METADATA.CASH_DIFFERENCE.requiredPermission).toBe('pos.cash.manage')
    expect(NOTIFICATION_METADATA.LOW_STOCK.requiredPermission).toBe('products.read')
    expect(NOTIFICATION_METADATA.REPAIR_READY.requiredPermission).toBe('repairs.orders.deliver')
    expect(NOTIFICATION_METADATA.EMPLOYEE_INVITED.requiredPermission).toBe('users.manage')
  })
})

describe('Notifications Phase 1 - Idempotency Keys', () => {
  it('builds deterministic idempotency keys for various event types', () => {
    const saleKey = buildNotificationIdempotencyKey({
      type: 'SALE_CREATED',
      resourceId: 'sale-987',
      qualifier: 'created',
    })
    expect(saleKey).toBe('sale:sale-987:created')

    const repairKey = buildNotificationIdempotencyKey({
      type: 'REPAIR_ASSIGNED',
      resourceId: 'rep-456',
      qualifier: 'assigned',
      targetUserId: 'usr-tech-1',
    })
    expect(repairKey).toBe('repair:rep-456:assigned:usr-usr-tech-1')

    const bookingReminder = buildNotificationIdempotencyKey({
      type: 'BOOKING_REMINDER',
      resourceId: 'book-111',
      qualifier: 'reminder:24h',
    })
    expect(bookingReminder).toBe('booking:book-111:reminder:24h')

    const creditKey = buildNotificationIdempotencyKey({
      type: 'CREDIT_OVERDUE',
      resourceId: 'cred-222',
      date: '2026-10-28',
    })
    expect(creditKey).toBe('credit:cred-222:overdue:2026-10-28')
  })

  it('does not depend on localized titles or user prose', () => {
    const key1 = buildNotificationIdempotencyKey({ type: 'SALE_CREATED', resourceId: '10' })
    const key2 = buildNotificationIdempotencyKey({ type: 'SALE_CREATED', resourceId: '10' })
    expect(key1).toBe(key2)
    expect(key1).toBe('sale:10:created')
  })
})

describe('Notifications Phase 1 - Default Preferences Resolution', () => {
  it('enables security and system alerts for all roles', () => {
    const roles = ['owner', 'admin', 'manager', 'technician', 'cashier', 'seller']
    for (const role of roles) {
      const secPref = resolveNotificationDefaultPreference('NEW_LOGIN', role)
      expect(secPref.pushEnabled).toBe(true)
      expect(secPref.inAppEnabled).toBe(true)

      const sysPref = resolveNotificationDefaultPreference('SUBSCRIPTION_EXPIRING', role)
      expect(sysPref.pushEnabled).toBe(true)
      expect(sysPref.inAppEnabled).toBe(true)
    }
  })

  it('enables personal repair assigned for technicians', () => {
    const pref = resolveNotificationDefaultPreference('REPAIR_ASSIGNED', 'technician')
    expect(pref.pushEnabled).toBe(true)
    expect(pref.inAppEnabled).toBe(true)
  })

  it('enables sales push for owners and managers, but not basic sellers by default', () => {
    const ownerPref = resolveNotificationDefaultPreference('SALE_CREATED', 'owner')
    expect(ownerPref.pushEnabled).toBe(true)

    const adminPref = resolveNotificationDefaultPreference('SALE_CREATED', 'admin')
    expect(adminPref.pushEnabled).toBe(true)

    const sellerPref = resolveNotificationDefaultPreference('SALE_CREATED', 'seller')
    expect(sellerPref.pushEnabled).toBe(false)
    expect(sellerPref.inAppEnabled).toBe(true)
  })

  it('keeps inventory push disabled by default to avoid alert fatigue', () => {
    const pref = resolveNotificationDefaultPreference('LOW_STOCK', 'owner')
    expect(pref.pushEnabled).toBe(false)
    expect(pref.inAppEnabled).toBe(true)
  })

  it('resolves cash alerts only for authorized roles', () => {
    const ownerCash = resolveNotificationDefaultPreference('CASH_DIFFERENCE', 'owner')
    expect(ownerCash.pushEnabled).toBe(true)
    expect(ownerCash.inAppEnabled).toBe(true)

    const cashierCash = resolveNotificationDefaultPreference('CASH_DIFFERENCE', 'cashier')
    expect(cashierCash.pushEnabled).toBe(true)
    expect(cashierCash.inAppEnabled).toBe(true)

    const techCash = resolveNotificationDefaultPreference('CASH_DIFFERENCE', 'technician')
    expect(techCash.pushEnabled).toBe(false)
    expect(techCash.inAppEnabled).toBe(false)
  })

  it('resolves category default toggles properly', () => {
    expect(resolveCategoryDefault('security', 'seller')).toBe(true)
    expect(resolveCategoryDefault('system', 'seller')).toBe(true)
    expect(resolveCategoryDefault('repairs', 'technician')).toBe(true)
    expect(resolveCategoryDefault('inventory', 'owner')).toBe(false)
    expect(resolveCategoryDefault('sales', 'seller')).toBe(false)
    expect(resolveCategoryDefault('sales', 'owner')).toBe(true)
  })
})
