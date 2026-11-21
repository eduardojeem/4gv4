import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isNotificationTypeVisible } from '@/lib/notifications/visibility'
import { IMPLEMENTED_NOTIFICATION_TYPES, NOTIFICATION_TYPES, type NotificationType } from '@/lib/notifications/types'
import { roleHasPermission } from '@/lib/saas/permissions'

const ALL_MODULES = ['inventory', 'inventory_admin', 'pos', 'crm', 'orders', 'ecommerce', 'repairs', 'services', 'credits']

describe('preferencias: solo los avisos que le pueden llegar al usuario', () => {
  it('oculta los avisos que todavía no se envían', () => {
    expect(isNotificationTypeVisible('BOOKING_REMINDER', { role: 'owner', modules: ALL_MODULES })).toBe(false)
    expect(isNotificationTypeVisible('CASH_DIFFERENCE', { role: 'owner', modules: ALL_MODULES })).toBe(false)
    expect(isNotificationTypeVisible('REPAIR_CREATED', { role: 'owner', modules: ALL_MODULES })).toBe(true)
  })

  it('un comercio sin taller (por rubro o porque lo apagó) no ve avisos de reparaciones', () => {
    const tiendaDeRopa = { role: 'owner', modules: ['inventory', 'pos', 'orders', 'ecommerce'] }
    expect(isNotificationTypeVisible('REPAIR_CREATED', tiendaDeRopa)).toBe(false)
    expect(isNotificationTypeVisible('REPAIR_DELIVERED', tiendaDeRopa)).toBe(false)
    expect(isNotificationTypeVisible('SALE_CREATED', tiendaDeRopa)).toBe(true)
  })

  it('respeta el permiso del rol', () => {
    const tecnico = { role: 'tecnico', modules: ALL_MODULES }
    expect(roleHasPermission('technician', 'billing.manage')).toBe(false)
    expect(isNotificationTypeVisible('SUBSCRIPTION_EXPIRING', tecnico)).toBe(false)
    expect(isNotificationTypeVisible('SUBSCRIPTION_EXPIRING', { role: 'owner', modules: ALL_MODULES })).toBe(true)
  })

  it('si no se pudieron leer los módulos, no oculta por módulo', () => {
    expect(isNotificationTypeVisible('REPAIR_CREATED', { role: 'owner', modules: null })).toBe(true)
  })
})

/** Archivos de src que llaman al dispatcher (fuera de tests y definiciones). */
function emitterSources(): Array<{ file: string; source: string }> {
  const root = join(process.cwd(), 'src')
  const out: Array<{ file: string; source: string }> = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        if (name === 'node_modules' || name === '__tests__' || name === 'test') continue
        walk(path)
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) {
        const source = readFileSync(path, 'utf8')
        if (source.includes('dispatchNotificationEvent(') && !path.endsWith(join('server', 'dispatcher.ts'))) {
          out.push({ file: relative(root, path), source })
        }
      }
    }
  }
  walk(root)
  return out
}

describe('contrato: la lista de avisos implementados coincide con el código', () => {
  const sources = emitterSources()
  const emitted = new Set<NotificationType>(
    NOTIFICATION_TYPES.filter((type) => sources.some(({ source }) => source.includes(`'${type}'`))),
  )

  it('todo aviso marcado como implementado tiene un punto de envío', () => {
    const missing = IMPLEMENTED_NOTIFICATION_TYPES.filter((type) => !emitted.has(type))
    expect(missing).toEqual([])
  })

  it('todo aviso que se envía está en la lista (si no, no aparece en preferencias)', () => {
    const unlisted = [...emitted].filter((type) => !IMPLEMENTED_NOTIFICATION_TYPES.includes(type))
    expect(unlisted).toEqual([])
  })
})
