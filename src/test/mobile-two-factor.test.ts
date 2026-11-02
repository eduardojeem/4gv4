import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { formatTotpSecret, totpSetupUri } from '../../mobile/src/lib/mfa-model'

const read = (path: string) => readFileSync(join(__dirname, '../../mobile/src', path), 'utf8')
const screen = read('app/panel/two-factor.tsx')

describe('verificación en dos pasos desde la app', () => {
  it('abre la app autenticadora del mismo teléfono con otpauth', () => {
    expect(totpSetupUri({ uri: 'otpauth://totp/x?secret=ABC', secret: 'ABC', account: 'a@b.py' })).toBe('otpauth://totp/x?secret=ABC')
    expect(totpSetupUri({ uri: null, secret: 'JBSWY3DP', account: 'ana@tienda.py' }))
      .toBe('otpauth://totp/MiTiendaPY%3Aana%40tienda.py?secret=JBSWY3DP&issuer=MiTiendaPY')
    expect(formatTotpSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP')
  })

  it('activar usa el mismo MFA de Supabase que la web y confirma con el primer código', () => {
    expect(screen).toContain("factorType: 'totp'")
    expect(screen).toContain('supabase.auth.mfa.challengeAndVerify({ factorId: pending.factorId, code })')
    // Una activación a medias se limpia antes y al cancelar.
    expect(screen).toContain("factor.status !== 'verified'")
    expect(screen).toContain('supabase.auth.mfa.unenroll({ factorId: pending.factorId })')
  })

  it('desactivar pide la contraseña y un código actual antes de quitar el factor', () => {
    const disable = screen.slice(screen.indexOf('const confirmDisable'))
    const password = disable.indexOf('verifyCurrentPassword(email, password)')
    const code = disable.indexOf('challengeAndVerify({ factorId: factor.id, code })')
    const unenroll = disable.indexOf('mfa.unenroll({ factorId: item.id })')
    expect(password).toBeGreaterThan(-1)
    expect(code).toBeGreaterThan(password)
    expect(unenroll).toBeGreaterThan(code)
  })

  it('se llega desde Mi perfil → Seguridad', () => {
    expect(read('app/panel/profile.tsx')).toContain("router.push('/panel/two-factor' as never)")
  })
})
