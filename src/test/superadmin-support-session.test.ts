import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ cookie: 'session-1' as string | undefined, row: null as Record<string, unknown> | null, error: null as { message: string } | null }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: () => {
  const filters: Record<string, unknown> = {}; let patch: Record<string, unknown> | null = null
  const q: Record<string, unknown> = {}
  q.select = vi.fn(() => q); q.eq = vi.fn((key, value) => { filters[key] = value; return q }); q.is = vi.fn((key, value) => { filters[key] = value; return q }); q.update = vi.fn(value => { patch = value; return q })
  const matches = () => state.row && Object.entries(filters).every(([key, value]) => state.row?.[key] === value)
  q.maybeSingle = vi.fn(async () => ({ data: matches() ? state.row : null, error: state.error }))
  q.then = (resolve: (value:unknown)=>unknown, reject: (error:unknown)=>unknown) => { if (!state.error && matches() && patch) Object.assign(state.row!, patch); return Promise.resolve({ error: state.error }).then(resolve, reject) }
  return q
} }) }))
import { getActiveSupportSession, endSupportSession, getSupportSessionForOrg } from '@/lib/superadmin/support-session'
beforeEach(() => { state.cookie = 'session-1'; state.error = null; state.row = { id:'session-1', super_admin_id:'admin-a', organization_id:'org-a', reason:'Diagnóstico solicitado', expires_at:new Date(Date.now()+60000).toISOString(), ended_at:null, organization:{ name:'Empresa Demo', slug:'demo' } } })
describe('sesión vinculada al actor', () => {
 it('acepta únicamente la sesión del superadmin actual', async () => {
  expect(await getActiveSupportSession('admin-a')).toMatchObject({organizationId:'org-a'})
  expect(await getActiveSupportSession('admin-b')).toBeNull()
 })
 it('no permite terminar la sesión de otro superadmin', async () => {
  await endSupportSession('session-1','admin-b')
  expect(state.row?.ended_at).toBeNull()
 })
 it('propaga errores al cerrar para permitir reintento', async () => {
  state.error={message:'falló persistencia'}
  await expect(endSupportSession('session-1','admin-a')).rejects.toThrow()
  expect(state.row?.ended_at).toBeNull()
 })
 it('cierra la propia sesión y deja de aceptarla', async () => {
  await endSupportSession('session-1','admin-a')
  expect(state.row?.ended_at).not.toBeNull()
  expect(await getActiveSupportSession('admin-a')).toBeNull()
 })
 it('descarta vencidas y no cruza la organización de la sesión', async () => {
  expect(await getSupportSessionForOrg('org-b','admin-a')).toBeNull()
  state.row!.expires_at=new Date(Date.now()-1000).toISOString()
  expect(await getActiveSupportSession('admin-a')).toBeNull()
 })
})
