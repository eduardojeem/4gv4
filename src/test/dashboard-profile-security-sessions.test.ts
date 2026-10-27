import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('dashboard profile security sessions', () => {
  const securitySource = read('src/components/profile/security-section.tsx')
  const passwordSource = read('src/components/profile/change-password-dialog.tsx')
  const profilePageSource = read('src/app/dashboard/profile/page.tsx')

  it('revokes other Supabase Auth sessions rather than only hiding their local records', () => {
    expect(securitySource).toContain("auth.signOut({ scope: 'others' })")
    expect(passwordSource).toContain("auth.signOut({ scope: 'others' })")
  })

  it('keeps a normal dashboard logout local to this device', () => {
    expect(profilePageSource).toContain("auth.signOut({ scope: 'local' })")
  })

  it('does not render a failed session lookup as an empty device list', () => {
    expect(securitySource).toMatch(/if \(error\) throw error/)
    expect(securitySource).toContain("setSessionsError('No se pudieron cargar las sesiones activas en este momento')")
  })

  it('lists and revokes real Supabase Auth sessions, not self-reported rows', () => {
    expect(securitySource).toContain("rpc('list_my_auth_sessions')")
    expect(securitySource).toContain("rpc('revoke_my_auth_session'")
    expect(securitySource).not.toContain('user_sessions')
    expect(securitySource).not.toContain('close_user_session')
    expect(securitySource).not.toContain('getSessionIdFromAccessToken')
  })

  it('the session functions only touch the caller own sessions', () => {
    const migration = read('supabase/migrations/20261026120000_own_auth_sessions_rpc.sql')
    expect(migration).toMatch(/where s\.user_id = \(select auth\.uid\(\)\)/)
    expect(migration).toMatch(/where s\.id = p_session_id\s+and s\.user_id = \(select auth\.uid\(\)\)/)
    expect(migration).toContain('revoke all on function public.revoke_my_auth_session(uuid) from public, anon;')
    expect(migration).not.toMatch(/create policy|alter policy|disable row level security/i)
  })

  it('does not expose raw session identifiers in the device list', () => {
    expect(securitySource).not.toContain('ID de sesión: {session.session_id}')
  })
})
