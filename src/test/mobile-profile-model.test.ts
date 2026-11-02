import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  avatarPath,
  avatarStoragePath,
  isProfileDirty,
  nameError,
  passwordChangeError,
  passwordStrength,
  phoneError,
  profilePatch,
} from '../../mobile/src/lib/profile-model'
import { dashboardProfilePatchSchema } from '@/lib/profile/dashboard-profile-contract'

const saved = { fullName: 'Ana', phone: '0981 123 456', jobTitle: 'Cajera' }
const screen = readFileSync(join(__dirname, '../../mobile/src/app/panel/profile.tsx'), 'utf8')

describe('Mi perfil en la app', () => {
  it('manda solo lo que cambió, sin null: borrar el teléfono es texto vacío y el servidor lo acepta', () => {
    const patch = profilePatch({ ...saved, phone: '  ' }, saved)
    expect(patch).toEqual({ phone: '' })
    expect(dashboardProfilePatchSchema.safeParse(patch).success).toBe(true)
    expect(isProfileDirty({ ...saved, fullName: ' Ana ' }, saved)).toBe(false)
  })

  it('valida nombre y teléfono', () => {
    expect(nameError('A')).toMatch(/al menos 2/)
    expect(nameError('Ana')).toBeNull()
    expect(phoneError('')).toBeNull()
    expect(phoneError('12')).toMatch(/incompleto/)
    expect(phoneError('abc')).toMatch(/solo números/)
  })

  it('cambiar la contraseña pide la actual, 8 caracteres y que sea distinta', () => {
    expect(passwordChangeError({ current: '', next: 'Nueva1234', confirm: 'Nueva1234' })).toMatch(/actual/)
    expect(passwordChangeError({ current: 'vieja', next: 'corta', confirm: 'corta' })).toMatch(/8/)
    expect(passwordChangeError({ current: 'Igual1234', next: 'Igual1234', confirm: 'Igual1234' })).toMatch(/distinta/)
    expect(passwordChangeError({ current: 'vieja', next: 'Nueva1234', confirm: 'Otra1234' })).toMatch(/no coincide/)
    expect(passwordChangeError({ current: 'vieja', next: 'Nueva1234', confirm: 'Nueva1234' })).toBeNull()
    expect(passwordStrength('Nueva-1234ab').score).toBe(4)
    expect(screen).toContain('verifyCurrentPassword(email, currentPassword)')
  })

  it('la foto va a la carpeta propia del usuario y solo se borra la anterior si es suya', () => {
    expect(avatarPath('u1', 'image/png', 5)).toBe('u1/avatar-5.png')
    const url = 'https://x.supabase.co/storage/v1/object/public/avatars/u1/avatar-1.jpg'
    expect(avatarStoragePath(url, 'u1')).toBe('u1/avatar-1.jpg')
    expect(avatarStoragePath(url, 'otro')).toBeNull()
    expect(avatarStoragePath('https://lh3.googleusercontent.com/a.png', 'u1')).toBeNull()
  })

  it('si el perfil no cargó no se puede guardar (no pisa teléfono ni cargo)', () => {
    expect(screen).toContain("loadState !== 'ready'")
    expect(screen).toContain('Cambios sin guardar')
  })
})
