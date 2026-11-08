import { describe, expect, it, vi } from 'vitest'
import {
  countUnreadAnnouncements,
  loadGlobalAnnouncements,
  markGlobalAnnouncements,
} from '@/lib/notifications/global-announcements'

const ORG = '11111111-1111-4111-8111-111111111111'
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** Cliente falso: `global_notifications` devuelve `notices`, las lecturas `reads`. */
function fakeAdmin(notices: Array<{ id: string }>, reads: Array<{ notification_id: string; dismissed: boolean }>) {
  const upsert = vi.fn(async () => ({ error: null }))
  const filters: string[] = []
  const admin = {
    from: (table: string) => {
      if (table === 'global_notifications') {
        const chain = {
          select: () => chain,
          eq: (column: string, value: string) => { filters.push(`${column}=${value}`); return chain },
          or: (value: string) => { filters.push(value); return chain },
          order: () => chain,
          limit: async () => ({
            data: notices.map((n) => ({ ...n, title: `Aviso ${n.id.slice(0, 1)}`, body: 'Texto', type: 'info', sent_at: '2026-11-07T12:00:00Z', created_at: '2026-11-07T11:00:00Z' })),
            error: null,
          }),
        }
        return chain
      }
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: async () => ({ data: reads, error: null }),
        upsert,
      }
      return chain
    },
  }
  return { admin: admin as never, upsert, filters }
}

describe('avisos de la plataforma para las tiendas', () => {
  it('trae solo publicados para todas o para esta organización, sin los descartados', async () => {
    const { admin, filters } = fakeAdmin([{ id: A }, { id: B }], [{ notification_id: B, dismissed: true }])
    const { items } = await loadGlobalAnnouncements(admin, ORG, 'user-1')
    expect(filters).toEqual(['status=sent', `target.eq.all,target_org_ids.cs.{${ORG}}`])
    expect(items.map((i) => i.id)).toEqual([A])
    expect(items[0]).toMatchObject({ read: false, timestamp: '2026-11-07T12:00:00Z' })
  })

  it('cuenta los no leídos', async () => {
    const { admin } = fakeAdmin([{ id: A }, { id: B }], [{ notification_id: A, dismissed: false }])
    const { items } = await loadGlobalAnnouncements(admin, ORG, 'user-1')
    expect(countUnreadAnnouncements(items)).toBe(1)
  })

  it('marcar como leído no deshace un descarte y no acepta avisos ajenos', async () => {
    const { admin, upsert } = fakeAdmin([{ id: A }], [])
    const result = await markGlobalAnnouncements(admin, { organizationId: ORG, userId: 'user-1', ids: [A, B], dismiss: false })
    expect(result.updated).toBe(1)
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ notification_id: A, user_id: 'user-1' })],
      { onConflict: 'notification_id,user_id', ignoreDuplicates: true },
    )
    expect((upsert.mock.calls[0] as unknown as [Array<Record<string, unknown>>])[0][0]).not.toHaveProperty('dismissed')
  })

  it('descartar guarda dismissed y pisa la lectura previa', async () => {
    const { admin, upsert } = fakeAdmin([{ id: A }, { id: B }], [])
    await markGlobalAnnouncements(admin, { organizationId: ORG, userId: 'user-1', ids: [B], dismiss: true })
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ notification_id: B, dismissed: true })],
      { onConflict: 'notification_id,user_id', ignoreDuplicates: false },
    )
  })

  it('«todas» marca los visibles', async () => {
    const { admin, upsert } = fakeAdmin([{ id: A }, { id: B }], [])
    const result = await markGlobalAnnouncements(admin, { organizationId: ORG, userId: 'user-1', ids: 'all', dismiss: false })
    expect(result.updated).toBe(2)
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it('una organización con id inválido no consulta ni marca nada', async () => {
    const { admin, upsert, filters } = fakeAdmin([{ id: A }], [])
    expect((await loadGlobalAnnouncements(admin, 'x,target.eq.all', 'user-1')).items).toEqual([])
    expect((await markGlobalAnnouncements(admin, { organizationId: 'x', userId: 'u', ids: 'all', dismiss: false })).updated).toBe(0)
    expect(filters).toEqual([])
    expect(upsert).not.toHaveBeenCalled()
  })
})
