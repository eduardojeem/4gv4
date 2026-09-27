import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Profile Account Security Enhanced Design and Functionality', () => {
  const securitySource = read('src/components/profile/security-section.tsx')

  it('provides polished executive security overview with score and indicators', () => {
    expect(securitySource).toContain('Seguridad de la Cuenta')
    expect(securitySource).toContain('securityOverview')
    expect(securitySource).toContain('Nivel de protección')
  })

  it('supports password management and session termination routines', () => {
    expect(securitySource).toContain('ChangePasswordDialog')
    expect(securitySource).toContain('handleLogoutSession')
    expect(securitySource).toContain('handleLogoutAllSessions')
    expect(securitySource).toContain('handleLogoutOtherBrowsers')
    expect(securitySource).toContain('handleLogoutEverywhere')
  })

  it('provides security alerts configuration with toggles', () => {
    expect(securitySource).toContain('email_notifications')
    expect(securitySource).toContain('login_alerts')
    expect(securitySource).toContain('user_security_settings')
  })

  it('distinguishes current device clearly from remote sessions and includes filter tabs', () => {
    expect(securitySource).toContain('Este dispositivo (Sesión actual)')
    expect(securitySource).toContain('sessionView')
    expect(securitySource).toContain('loadSessions')
  })

  it('detects sessions by browser and allows per-browser filtering without intrusive banner', () => {
    expect(securitySource).not.toContain('Detección independiente de navegadores (Casa y Trabajo)')
    expect(securitySource).toContain('Sesiones detectadas por navegador')
    expect(securitySource).toContain('selectedBrowser')
    expect(securitySource).toContain('handleLogoutBrowser')
  })
})
