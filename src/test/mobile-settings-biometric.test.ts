import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(__dirname, '../../mobile/src', path), 'utf8')

describe('huella / Face ID en Configuración de la app', () => {
  it('Configuración muestra el interruptor en «Este teléfono»', () => {
    const settings = read('app/admin/settings/index.tsx')
    expect(settings).toContain('Este teléfono')
    expect(settings).toContain('<BiometricSettingCard />')
  })

  it('usa la misma sesión que el menú del avatar y Mi perfil, y avisa si el teléfono no lo tiene configurado', () => {
    const card = read('components/settings/biometric-setting.tsx')
    expect(card).toContain('setBiometricEnabled(next)')
    expect(card).toContain('disabled={saving || !biometric.available}')
    expect(card).toContain('Configurá la huella o el reconocimiento facial')
  })
})
