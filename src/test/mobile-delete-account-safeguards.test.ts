import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const screen = readFileSync(join(__dirname, '../../mobile/src/app/delete-account.tsx'), 'utf8')

/** Eliminar la cuenta en la app no puede pasar con un toque sin querer. */
describe('protecciones al eliminar la cuenta en la app', () => {
  it('hay un paso de avisos con casillas antes de pedir la contraseña', () => {
    expect(screen).toContain("useState<Step>('review')")
    expect(screen).toContain('disabled={!allChecked}')
    expect(screen).toContain("key: 'business'")
    expect(screen).toContain('Conservar mi cuenta')
  })

  it('ofrece alternativas: otro administrador, cerrar sesión o soporte', () => {
    expect(screen).toContain("router.push('/admin/users' as never)")
    expect(screen).toContain('Solo cerrar sesión en este teléfono')
    expect(screen).toContain('mailto:${supportEmail}')
  })

  it('el botón final se mantiene apretado 3 segundos y soltarlo cancela', () => {
    expect(screen).toContain('const HOLD_TO_DELETE_MS = 3000')
    expect(screen).toMatch(/onPressIn=\{start\}\s*onPressOut=\{cancel\}/)
    expect(screen).toContain('if (!finished) return;')
  })

  it('con huella o Face ID configurados, también se confirma con eso antes de enviar', () => {
    const biometric = screen.indexOf('authenticateWithBiometrics(')
    const request = screen.indexOf("method: 'POST'")
    expect(biometric).toBeGreaterThan(-1)
    expect(biometric).toBeLessThan(request)
    expect(screen).toContain('Tu cuenta sigue activa.')
  })

  it('no se puede pegar la palabra de confirmación', () => {
    expect(screen).toContain('contextMenuHidden')
  })
})
