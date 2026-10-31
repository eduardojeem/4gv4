// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchNotificationEvent } from '@/lib/notifications/server/dispatcher'
import { getEffectiveNotificationPreference } from '@/lib/notifications/server/preferences'
import * as subService from '@/lib/saas/subscription-service'
import * as adminSupabaseModule from '@/lib/supabase/admin'
import * as requestAuthModule from '@/lib/auth/request-auth'
import * as saasContextModule from '@/lib/saas/context'
import { NextRequest } from 'next/server'

// Handlers de las rutas de API
import { GET as getFeed } from '@/app/api/notifications/route'
import { GET as getUnreadCount } from '@/app/api/notifications/unread-count/route'
import { POST as markRead } from '@/app/api/notifications/read/route'
import { PUT as putPreferences } from '@/app/api/notifications/preferences/route'
import { POST as registerPushDevice } from '@/app/api/mobile/push/register/route'
import { POST as unregisterPushDevice } from '@/app/api/mobile/push/unregister/route'

describe('Notifications Phase 2 - Backend Engine & API Tests', () => {
  const orgA = '11111111-1111-1111-1111-111111111111'
  const orgB = '22222222-2222-2222-2222-222222222222'
  const ownerUser = 'owner-1111-1111-1111-111111111111'
  const branchUser1 = 'emp-branch-1-1111-111111111111'
  const branchUser2 = 'emp-branch-2-1111-111111111111'
  const techUser = 'tech-1111-1111-1111-111111111111'
  const sellerUser = 'seller-1111-1111-1111-111111111111'
  const branchA = 'branch-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const branchB = 'branch-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

  // Tablas en memoria simuladas para pruebas unitarias rápidas
  let dbMembers: Array<{ organization_id: string; user_id: string; role: string; status: string }>
  let dbAssignments: Array<{ organization_id: string; branch_id: string; user_id: string; is_active: boolean }>
  let dbPreferences: Array<{ organization_id: string; user_id: string; notification_type: string; push_enabled: boolean; in_app_enabled: boolean }>
  let dbNotifications: Array<{
    id: string
    organization_id: string
    branch_id: string | null
    user_id: string
    type: string
    title: string
    body: string
    data: Record<string, unknown>
    resource_type: string | null
    resource_id: string | null
    idempotency_key: string | null
    read_at: string | null
    created_at: string
  }>
  let dbPushDevices: Array<{
    id: string
    organization_id: string
    user_id: string
    device_id: string
    platform: string
    push_token: string
    enabled: boolean
    app_version: string | null
    last_seen_at: string
  }>

  let mockModules: string[] = ['inventory', 'pos', 'repairs', 'services', 'credits', 'orders']

  beforeEach(() => {
    vi.restoreAllMocks()

    mockModules = ['inventory', 'pos', 'repairs', 'services', 'credits', 'orders']

    dbMembers = [
      { organization_id: orgA, user_id: ownerUser, role: 'owner', status: 'active' },
      { organization_id: orgA, user_id: branchUser1, role: 'manager', status: 'active' },
      { organization_id: orgA, user_id: branchUser2, role: 'cashier', status: 'active' },
      { organization_id: orgA, user_id: techUser, role: 'technician', status: 'active' },
      { organization_id: orgA, user_id: sellerUser, role: 'seller', status: 'active' },
      // Miembro de otra organización
      { organization_id: orgB, user_id: 'intruder-org-b', role: 'owner', status: 'active' },
      // Miembro inactivo
      { organization_id: orgA, user_id: 'inactive-user', role: 'seller', status: 'suspended' },
    ]

    dbAssignments = [
      { organization_id: orgA, branch_id: branchA, user_id: branchUser1, is_active: true },
      { organization_id: orgA, branch_id: branchB, user_id: branchUser2, is_active: true },
      { organization_id: orgA, branch_id: branchA, user_id: techUser, is_active: true },
    ]

    dbPreferences = []
    dbNotifications = []
    dbPushDevices = []

    // Mock getOrganizationPlanInfo
    vi.spyOn(subService, 'getOrganizationPlanInfo').mockImplementation(async () => ({
      code: 'PRO',
      name: 'Plan Pro',
      repairPhotoLimit: 5,
      repairPhotoUpgradePlan: null,
      modules: mockModules,
      modulePlanAvailability: {},
      entitledModules: mockModules,
      enabledModules: null,
      effectiveModules: mockModules as any,
      serviceSpecialties: [],
      attentionMode: 'local',
      appointmentMode: 'walk_in',
      businessVertical: 'retail',
      operatingModel: 'standard',
      downgradedFromExpiry: false,
    }))

    // Mock createAdminSupabase para simular la base de datos
    vi.spyOn(adminSupabaseModule, 'createAdminSupabase').mockReturnValue({
      from: (table: string) => {
        let currentRows: any[] = []
        if (table === 'organization_members') currentRows = dbMembers
        else if (table === 'user_branch_assignments') currentRows = dbAssignments
        else if (table === 'notification_preferences') currentRows = dbPreferences
        else if (table === 'notifications') currentRows = dbNotifications
        else if (table === 'push_devices') currentRows = dbPushDevices

        let filtered = [...currentRows]
        let isCountQuery = false
        let isHeadQuery = false
        let pendingUpdates: any = null

        const builder: any = {
          select: (fields?: string, options?: { count?: string; head?: boolean }) => {
            if (options?.count) isCountQuery = true
            if (options?.head) isHeadQuery = true
            return builder
          },
          eq: (col: string, val: any) => {
            filtered = filtered.filter((r) => r[col] === val)
            return builder
          },
          neq: (col: string, val: any) => {
            filtered = filtered.filter((r) => r[col] !== val)
            return builder
          },
          in: (col: string, vals: any[]) => {
            filtered = filtered.filter((r) => vals.includes(r[col]))
            return builder
          },
          is: (col: string, val: any) => {
            filtered = filtered.filter((r) => r[col] === val)
            return builder
          },
          lt: (col: string, val: any) => {
            filtered = filtered.filter((r) => r[col] < val)
            return builder
          },
          order: (col: string, opts?: { ascending?: boolean }) => {
            filtered.sort((a, b) => {
              const asc = opts?.ascending ?? true
              return asc ? (a[col] > b[col] ? 1 : -1) : (a[col] < b[col] ? 1 : -1)
            })
            return builder
          },
          limit: (n: number) => {
            filtered = filtered.slice(0, n)
            return builder
          },
          single: async () => {
            const row = filtered[0]
            return { data: row ?? null, error: row ? null : { message: 'Row not found' } }
          },
          maybeSingle: async () => {
            const row = filtered[0]
            return { data: row ?? null, error: null }
          },
          insert: (recordOrRecords: any) => {
            const records = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords]
            let insertedRow: any = null
            let err: any = null

            for (const rec of records) {
              if (table === 'notifications' && rec.idempotency_key) {
                const existing = dbNotifications.find(
                  (n) =>
                    n.organization_id === rec.organization_id &&
                    n.user_id === rec.user_id &&
                    n.idempotency_key === rec.idempotency_key
                )
                if (existing) {
                  err = { code: '23505', message: 'duplicate key value violates unique constraint' }
                  continue
                }
              }
              const newRec = { ...rec, created_at: rec.created_at ?? new Date().toISOString() }
              if (table === 'notifications') dbNotifications.push(newRec)
              insertedRow = newRec
            }

            return {
              select: () => ({
                single: async () => ({ data: insertedRow, error: err }),
              }),
              then: (resolve: any) => resolve({ data: insertedRow, error: err }),
            }
          },
          upsert: (record: any, opts?: { onConflict?: string }) => {
            let savedRecord = record
            if (table === 'notification_preferences') {
              const idx = dbPreferences.findIndex(
                (p) =>
                  p.organization_id === record.organization_id &&
                  p.user_id === record.user_id &&
                  p.notification_type === record.notification_type
              )
              if (idx >= 0) {
                dbPreferences[idx] = { ...dbPreferences[idx], ...record }
                savedRecord = dbPreferences[idx]
              } else {
                dbPreferences.push(record)
                savedRecord = record
              }
            } else if (table === 'push_devices') {
              const idx = dbPushDevices.findIndex(
                (p) =>
                  p.organization_id === record.organization_id &&
                  p.user_id === record.user_id &&
                  p.device_id === record.device_id
              )
              if (idx >= 0) {
                dbPushDevices[idx] = { ...dbPushDevices[idx], ...record }
                savedRecord = dbPushDevices[idx]
              } else {
                const newDev = { ...record, id: 'dev-' + Math.random().toString().slice(2, 6) }
                dbPushDevices.push(newDev)
                savedRecord = newDev
              }
            }
            return {
              select: () => ({
                single: async () => ({ data: savedRecord, error: null }),
              }),
              error: null,
              then: (resolve: any) => resolve({ data: savedRecord, error: null }),
            }
          },
          update: (updates: any) => {
            pendingUpdates = updates
            return builder
          },
          then: (resolve: any) => {
            if (pendingUpdates) {
              const updatedRows: any[] = []
              for (const r of filtered) {
                Object.assign(r, pendingUpdates)
                updatedRows.push(r)
              }
              return resolve({ data: updatedRows, error: null, count: updatedRows.length })
            }
            if (isCountQuery && isHeadQuery) {
              return resolve({ count: filtered.length, error: null })
            }
            return resolve({ data: filtered, error: null, count: filtered.length })
          },
        }

        return builder
      },
    } as any)
  })

  // Helper para simular llamadas HTTP a los Route Handlers
  function mockAuthSession(user: { id: string; email?: string; role?: string } | null, orgId: string = orgA, orgRole: string = 'owner') {
    if (!user) {
      vi.spyOn(requestAuthModule, 'resolveRequestAuthUser').mockResolvedValue({
        authenticated: false,
        reason: 'unauthenticated',
      })
      vi.spyOn(saasContextModule, 'getCurrentOrganizationContext').mockResolvedValue(null)
    } else {
      vi.spyOn(requestAuthModule, 'resolveRequestAuthUser').mockResolvedValue({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email ?? 'test@example.com',
          role: 'admin' as any,
          roleIsActive: true,
          profileStatus: 'active',
        },
      })
      vi.spyOn(saasContextModule, 'getCurrentOrganizationContext').mockResolvedValue({
        id: orgId,
        name: 'Tienda Test',
        slug: 'tienda-test',
        plan: 'PRO' as any,
        logoUrl: null,
        role: orgRole as any,
      })
    }
  }

  // --------------------------------------------------------------------------
  // Tests 1 - 5: Destinatarios, Tenant y Sucursales
  // --------------------------------------------------------------------------
  it('1. Owner receives allowed organization notification', async () => {
    const res = await dispatchNotificationEvent({
      organizationId: orgA,
      type: 'SALE_CREATED',
      resourceId: 'sale-1',
    })
    expect(res.createdNotifications).toBeGreaterThan(0)
    expect(dbNotifications.some((n) => n.user_id === ownerUser)).toBe(true)
  })

  it('2. User from another organization does not receive it', async () => {
    await dispatchNotificationEvent({
      organizationId: orgA,
      type: 'SALE_CREATED',
      resourceId: 'sale-2',
    })
    expect(dbNotifications.some((n) => n.user_id === 'intruder-org-b')).toBe(false)
  })

  it('3. Branch-scoped employee receives event from assigned branch', async () => {
    await dispatchNotificationEvent({
      organizationId: orgA,
      branchId: branchA,
      type: 'CASH_REGISTER_OPENED',
      resourceId: 'cash-1',
    })
    // branchUser1 está asignado a branchA -> recibe
    expect(dbNotifications.some((n) => n.user_id === branchUser1)).toBe(true)
  })

  it('4. Employee from another branch is skipped', async () => {
    const res = await dispatchNotificationEvent({
      organizationId: orgA,
      branchId: branchA,
      type: 'CASH_REGISTER_OPENED',
      resourceId: 'cash-2',
    })
    // branchUser2 está asignado a branchB, no a branchA -> skipped
    expect(dbNotifications.some((n) => n.user_id === branchUser2)).toBe(false)
    expect(res.skippedByBranch).toBeGreaterThan(0)
  })

  it('5. Owner/admin behavior matches global visibility rules across branches', async () => {
    await dispatchNotificationEvent({
      organizationId: orgA,
      branchId: branchB, // Rama B
      type: 'CASH_REGISTER_OPENED',
      resourceId: 'cash-3',
    })
    // Owner no tiene fila en user_branch_assignments para branchB, pero recibe por visibilidad global
    expect(dbNotifications.some((n) => n.user_id === ownerUser)).toBe(true)
  })

  // --------------------------------------------------------------------------
  // Tests 6 - 8: Personal, Permisos y Módulo Gating
  // --------------------------------------------------------------------------
  it('6. Personal REPAIR_ASSIGNED targets only assigned user', async () => {
    const res = await dispatchNotificationEvent({
      organizationId: orgA,
      type: 'REPAIR_ASSIGNED',
      resourceId: 'ticket-99',
      targetUserIds: [techUser],
    })
    expect(res.createdNotifications).toBe(1)
    expect(dbNotifications.some((n) => n.user_id === techUser)).toBe(true)
    expect(dbNotifications.some((n) => n.user_id === ownerUser)).toBe(false)
  })

  it('7. Permission-restricted event excludes unauthorized user', async () => {
    // EMPLOYEE_INVITED requiere 'users.manage'. Los roles 'seller', 'cashier', etc. no lo tienen (solo owner/admin).
    const res = await dispatchNotificationEvent({
      organizationId: orgA,
      type: 'EMPLOYEE_INVITED',
      resourceId: 'invite-1',
    })
    expect(dbNotifications.some((n) => n.user_id === sellerUser)).toBe(false)
    expect(dbNotifications.some((n) => n.user_id === ownerUser)).toBe(true)
    expect(res.skippedByPermission).toBeGreaterThan(0)
  })

  it('8. Disabled module produces no notification', async () => {
    // Deshabilitar módulo 'repairs'
    mockModules = ['inventory', 'pos']
    const res = await dispatchNotificationEvent({
      organizationId: orgA,
      type: 'REPAIR_CREATED',
      resourceId: 'rep-new',
    })
    expect(res.skippedByModule).toBe(true)
    expect(res.createdNotifications).toBe(0)
    expect(dbNotifications.length).toBe(0)
  })

  // --------------------------------------------------------------------------
  // Tests 9 - 12: Preferencias e Idempotencia
  // --------------------------------------------------------------------------
  it('9. in_app_enabled false prevents DB notification', async () => {
    // Desactivar in-app para el owner en SALE_CREATED
    dbPreferences.push({
      organization_id: orgA,
      user_id: ownerUser,
      notification_type: 'SALE_CREATED',
      push_enabled: true,
      in_app_enabled: false,
    })

    const res = await dispatchNotificationEvent({
      organizationId: orgA,
      type: 'SALE_CREATED',
      targetUserIds: [ownerUser],
    })
    expect(res.createdNotifications).toBe(0)
    expect(res.skippedByPreference).toBe(1)
    expect(dbNotifications.some((n) => n.user_id === ownerUser)).toBe(false)
  })

  it('10. Explicit preference overrides default preference', async () => {
    // Default de inventario para seller es false. Forzar explicitamente true:
    dbPreferences.push({
      organization_id: orgA,
      user_id: sellerUser,
      notification_type: 'LOW_STOCK',
      push_enabled: true,
      in_app_enabled: true,
    })

    const pref = await getEffectiveNotificationPreference({
      organizationId: orgA,
      userId: sellerUser,
      notificationType: 'LOW_STOCK',
      role: 'seller',
    })
    expect(pref.source).toBe('explicit')
    expect(pref.inAppEnabled).toBe(true)
  })

  it('11. Duplicate event creates one notification', async () => {
    const idempotencyKey = 'sale_order_1001'
    const res1 = await dispatchNotificationEvent({
      organizationId: orgA,
      type: 'SALE_CREATED',
      targetUserIds: [ownerUser],
      idempotencyKey,
    })
    expect(res1.createdNotifications).toBe(1)
    expect(res1.duplicates).toBe(0)

    // Reintento con la misma clave
    const res2 = await dispatchNotificationEvent({
      organizationId: orgA,
      type: 'SALE_CREATED',
      targetUserIds: [ownerUser],
      idempotencyKey,
    })
    expect(res2.createdNotifications).toBe(0)
    expect(res2.duplicates).toBe(1)
  })

  it('12. Retry does not throw fatal error', async () => {
    const key = 'sale_retry_safe'
    await expect(
      (async () => {
        await dispatchNotificationEvent({ organizationId: orgA, type: 'SALE_CREATED', idempotencyKey: key })
        await dispatchNotificationEvent({ organizationId: orgA, type: 'SALE_CREATED', idempotencyKey: key })
      })()
    ).resolves.not.toThrow()
  })

  // --------------------------------------------------------------------------
  // Tests 13 - 17: Feed, Unread y Preferences APIs
  // --------------------------------------------------------------------------
  it('13. GET feed returns own org/user rows only', async () => {
    mockAuthSession({ id: ownerUser })
    dbNotifications.push(
      {
        id: 'notif-1',
        organization_id: orgA,
        branch_id: null,
        user_id: ownerUser,
        type: 'SALE_CREATED',
        title: 'Venta',
        body: 'Cuerpo',
        data: {},
        resource_type: null,
        resource_id: null,
        idempotency_key: null,
        read_at: null,
        created_at: '2026-10-27T10:00:00Z',
      },
      {
        id: 'notif-2',
        organization_id: orgA,
        branch_id: null,
        user_id: branchUser1,
        type: 'SALE_CREATED',
        title: 'Venta Otro',
        body: 'Cuerpo',
        data: {},
        resource_type: null,
        resource_id: null,
        idempotency_key: null,
        read_at: null,
        created_at: '2026-10-27T11:00:00Z',
      }
    )

    const req = new NextRequest('http://localhost:3000/api/notifications')
    const res = await getFeed(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.items.length).toBe(1)
    expect(json.items[0].id).toBe('notif-1')
  })

  it('14. Unread count correct', async () => {
    mockAuthSession({ id: ownerUser })
    dbNotifications.push(
      {
        id: 'notif-unread-1',
        organization_id: orgA,
        branch_id: null,
        user_id: ownerUser,
        type: 'SALE_CREATED',
        title: 'Venta 1',
        body: 'Cuerpo',
        data: {},
        resource_type: null,
        resource_id: null,
        idempotency_key: null,
        read_at: null,
        created_at: '2026-10-27T10:00:00Z',
      },
      {
        id: 'notif-read-2',
        organization_id: orgA,
        branch_id: null,
        user_id: ownerUser,
        type: 'SALE_CREATED',
        title: 'Venta 2',
        body: 'Cuerpo',
        data: {},
        resource_type: null,
        resource_id: null,
        idempotency_key: null,
        read_at: '2026-10-27T12:00:00Z',
        created_at: '2026-10-27T11:00:00Z',
      }
    )

    const req = new NextRequest('http://localhost:3000/api/notifications/unread-count')
    const res = await getUnreadCount(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.count).toBe(1)
  })

  it('15. User can mark own notification read', async () => {
    mockAuthSession({ id: ownerUser })
    dbNotifications.push({
      id: 'notif-to-read',
      organization_id: orgA,
      branch_id: null,
      user_id: ownerUser,
      type: 'SALE_CREATED',
      title: 'Venta',
      body: 'Cuerpo',
      data: {},
      resource_type: null,
      resource_id: null,
      idempotency_key: null,
      read_at: null,
      created_at: '2026-10-27T10:00:00Z',
    })

    const req = new NextRequest('http://localhost:3000/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ notificationId: 'notif-to-read' }),
    })
    const res = await markRead(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(dbNotifications.find((n) => n.id === 'notif-to-read')?.read_at).not.toBeNull()
  })

  it('16. User cannot mark another user notification read', async () => {
    mockAuthSession({ id: ownerUser })
    dbNotifications.push({
      id: 'other-user-notif',
      organization_id: orgA,
      branch_id: null,
      user_id: branchUser1,
      type: 'SALE_CREATED',
      title: 'Venta',
      body: 'Cuerpo',
      data: {},
      resource_type: null,
      resource_id: null,
      idempotency_key: null,
      read_at: null,
      created_at: '2026-10-27T10:00:00Z',
    })

    const req = new NextRequest('http://localhost:3000/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ notificationId: 'other-user-notif' }),
    })
    const res = await markRead(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.updatedCount).toBe(0)
    expect(dbNotifications.find((n) => n.id === 'other-user-notif')?.read_at).toBeNull()
  })

  it('17. Preferences cannot be written for another user or organization', async () => {
    mockAuthSession({ id: ownerUser }, orgA)
    const req = new NextRequest('http://localhost:3000/api/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        notificationType: 'SALE_CREATED',
        pushEnabled: false,
        inAppEnabled: true,
        // Intentar inyectar otro user_id / org_id en el payload
        userId: 'spoofed-user',
        organizationId: orgB,
      }),
    })
    const res = await putPreferences(req)
    expect(res.status).toBe(200)

    // Se guardó para ownerUser y orgA, ignorando completamente los datos inyectados
    const saved = dbPreferences.find((p) => p.user_id === ownerUser && p.organization_id === orgA)
    expect(saved).toBeDefined()
    expect(saved?.push_enabled).toBe(false)
    expect(dbPreferences.some((p) => p.user_id === 'spoofed-user')).toBe(false)
  })

  // --------------------------------------------------------------------------
  // Tests 18 - 20: Push Devices y Autenticación
  // --------------------------------------------------------------------------
  it('18. Register device derives user and org server-side', async () => {
    mockAuthSession({ id: ownerUser }, orgA)
    const req = new NextRequest('http://localhost:3000/api/mobile/push/register', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'device-xyz',
        platform: 'android',
        pushToken: 'ExponentPushToken[abc12345]',
        appVersion: '1.2.0',
        userId: 'fake-user-attempt',
        organizationId: orgB,
      }),
    })
    const res = await registerPushDevice(req)
    expect(res.status).toBe(200)

    const dev = dbPushDevices.find((d) => d.device_id === 'device-xyz')
    expect(dev).toBeDefined()
    expect(dev?.user_id).toBe(ownerUser)
    expect(dev?.organization_id).toBe(orgA)
    expect(dev?.enabled).toBe(true)
  })

  it('19. Unregister disables only correct device record', async () => {
    mockAuthSession({ id: ownerUser }, orgA)
    dbPushDevices.push({
      id: 'dev-1',
      organization_id: orgA,
      user_id: ownerUser,
      device_id: 'device-my-phone',
      platform: 'ios',
      push_token: 'token-1',
      enabled: true,
      app_version: '1.0.0',
      last_seen_at: new Date().toISOString(),
    })

    const req = new NextRequest('http://localhost:3000/api/mobile/push/unregister', {
      method: 'POST',
      body: JSON.stringify({ deviceId: 'device-my-phone' }),
    })
    const res = await unregisterPushDevice(req)
    expect(res.status).toBe(200)

    const dev = dbPushDevices.find((d) => d.device_id === 'device-my-phone')
    expect(dev?.enabled).toBe(false)
  })

  it('20. Anonymous requests rejected with 401', async () => {
    mockAuthSession(null) // Sin sesión
    const req = new NextRequest('http://localhost:3000/api/notifications')
    const res = await getFeed(req)
    expect(res.status).toBe(401)
  })
})
