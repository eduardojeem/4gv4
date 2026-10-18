import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { secureStorage } from '../../mobile/src/lib/secure-storage.web'

describe('sesión del cliente web de Expo', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.unstubAllGlobals())
  it('lee, guarda y borra sin invocar SecureStore nativo', async () => {
    expect(await secureStorage.getItem('session')).toBeNull()
    await secureStorage.setItem('session', 'test-session')
    expect(await secureStorage.getItem('session')).toBe('test-session')
    await secureStorage.removeItem('session')
    expect(await secureStorage.getItem('session')).toBeNull()
  })
  it('no conserva una sesión en memoria del servidor durante SSR', async () => {
    vi.stubGlobal('window', undefined)
    await secureStorage.setItem('session', 'server-must-not-retain-this')
    expect(await secureStorage.getItem('session')).toBeNull()
    await secureStorage.removeItem('session')
  })
})
