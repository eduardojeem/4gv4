import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ superAdmin: vi.fn(), update: vi.fn(), eq: vi.fn() }))
vi.mock('@/lib/superadmin/auth', () => ({ getSuperAdminUser: mocks.superAdmin }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({ from: () => ({ update: mocks.update.mockReturnValue({ eq: mocks.eq }) }) }),
}))

import { parseFeedbackFilters } from '@/lib/feedback/user-feedback'
import { setFeedbackStatusAction } from '@/app/superadmin/comentarios/actions'

const ID = '5b0b0b6e-6d2f-4c3a-9a51-0c3a2f5e8d11'

afterEach(() => vi.clearAllMocks())

describe('bandeja de comentarios del superadmin', () => {
  it('por defecto muestra los nuevos; valida tipo, estado y página', () => {
    expect(parseFeedbackFilters({})).toEqual({ kind: 'all', status: 'new', page: 1 })
    expect(parseFeedbackFilters({ tipo: 'bug', estado: 'all', pagina: '3' })).toEqual({ kind: 'bug', status: 'all', page: 3 })
    expect(parseFeedbackFilters({ tipo: 'x', estado: 'y', pagina: '-4' })).toEqual({ kind: 'all', status: 'new', page: 1 })
  })

  it('solo un superadmin cambia el estado, y con datos válidos', async () => {
    mocks.superAdmin.mockResolvedValueOnce(null)
    expect(await setFeedbackStatusAction(ID, 'done')).toEqual({ ok: false, error: 'Acceso denegado' })

    mocks.superAdmin.mockResolvedValue({ id: 'sa', email: null, role: 'super_admin' })
    expect(await setFeedbackStatusAction(ID, 'borrado')).toEqual({ ok: false, error: 'Datos inválidos' })
    expect(mocks.update).not.toHaveBeenCalled()

    mocks.eq.mockResolvedValueOnce({ error: null })
    expect(await setFeedbackStatusAction(ID, 'reviewed')).toEqual({ ok: true })
    expect(mocks.update).toHaveBeenCalledWith({ status: 'reviewed' })
    expect(mocks.eq).toHaveBeenCalledWith('id', ID)
  })
})
