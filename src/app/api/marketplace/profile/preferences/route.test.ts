import { describe, expect, it } from 'vitest'
import { preferenceDefaults, preferencePatchSchema, usernameSchema } from './route'

describe('marketplace preference contract', () => {
  it('keeps optional exposure disabled by default', () => {
    expect(preferenceDefaults.promotions).toBe(false)
    expect(preferenceDefaults.marketingCommunications).toBe(false)
    expect(preferenceDefaults.publicProfile).toBe(false)
  })

  it('rejects unknown preference fields', () => {
    expect(preferencePatchSchema.safeParse({ promotions: true, role: 'admin' }).success).toBe(false)
  })

  // El switch "Perfil público" ya existia, pero guardaba en
  // marketplace_user_preferences.public_profile -una columna que nada mas
  // leia-, mientras que la pagina publica y su politica RLS miran
  // profiles.is_public. Prenderlo no hacia absolutamente nada. Ahora
  // publicProfile viaja en el mismo PATCH pero se aplica sobre profiles.
  it('accepts publicProfile alongside a username in the same patch', () => {
    const result = preferencePatchSchema.safeParse({ publicProfile: true, username: 'ana_reparaciones' })
    expect(result.success).toBe(true)
  })
})

describe('usernameSchema', () => {
  it('accepts lowercase letters, numbers and underscores', () => {
    expect(usernameSchema.safeParse('ana_reparaciones_99').success).toBe(true)
  })

  it('rejects usernames shorter than 3 characters', () => {
    expect(usernameSchema.safeParse('an').success).toBe(false)
  })

  it('rejects spaces and uppercase letters', () => {
    expect(usernameSchema.safeParse('Ana Reparaciones').success).toBe(false)
  })
})
