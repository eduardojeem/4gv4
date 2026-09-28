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
    expect(securitySource).toMatch(
      /if \(loadError && rows\.length === 0\) \{\s+setSessionsError\('No se pudieron cargar las sesiones activas en este momento'\)/
    )
  })

  it('does not expose raw session identifiers in the device list', () => {
    expect(securitySource).not.toContain('ID de sesión: {session.session_id}')
  })
})
