import { describe, expect, it } from 'vitest'
import { shouldReuseAuthenticatedUser } from './auth-event-stability'

describe('shouldReuseAuthenticatedUser', () => {
  it('conserva el perfil cuando Supabase confirma al mismo usuario al volver a la pestaña', () => {
    expect(shouldReuseAuthenticatedUser('SIGNED_IN', 'user-1', 'user-1', true)).toBe(true)
    expect(shouldReuseAuthenticatedUser('TOKEN_REFRESHED', 'user-1', 'user-1', false)).toBe(true)
  })

  it('carga el perfil cuando cambia el usuario o se actualizan sus datos', () => {
    expect(shouldReuseAuthenticatedUser('SIGNED_IN', 'user-2', 'user-1', true)).toBe(false)
    expect(shouldReuseAuthenticatedUser('SIGNED_IN', 'user-1', null, true)).toBe(false)
    expect(shouldReuseAuthenticatedUser('SIGNED_IN', 'user-1', 'user-1', false)).toBe(false)
    expect(shouldReuseAuthenticatedUser('USER_UPDATED', 'user-1', 'user-1')).toBe(false)
    expect(shouldReuseAuthenticatedUser('SIGNED_OUT', null, 'user-1')).toBe(false)
  })
})
