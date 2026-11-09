import { beforeEach, describe, expect, it, vi } from 'vitest'
const { signIn, signOut } = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn().mockResolvedValue({}) }))
vi.mock('react-native', () => ({ AppState: { currentState: 'inactive', addEventListener: vi.fn() } }))
vi.mock('../../mobile/node_modules/@supabase/supabase-js', () => ({ createClient: () => ({ auth: { signInWithPassword: signIn, signOut } }) }))
// En CI no está mobile/node_modules: la app toma supabase-js de la raíz.
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { signInWithPassword: signIn, signOut } }) }))
vi.mock('../../mobile/src/lib/secure-storage', () => ({ secureStorage: {} }))
vi.mock('../../mobile/src/lib/runtime-config', () => ({ getMobileRuntimeConfig: () => ({ supabaseUrl: 'https://example.test', supabaseKey: 'fake' }) }))
import { verifyCurrentPassword } from '../../mobile/src/lib/supabase'
describe('mobile password verification', () => {
 beforeEach(() => vi.clearAllMocks())
 it('only calls invalid credentials a wrong password', async () => {
  signIn.mockResolvedValue({ data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } })
  expect(await verifyCurrentPassword('a@example.test', 'fake')).toBe(false)
 })
 it('explains captcha without replacing the saved session', async () => {
  signIn.mockResolvedValue({ data: {}, error: { code: 'captcha_failed', message: 'captcha protection: request disallowed' } })
  await expect(verifyCurrentPassword('a@example.test', 'fake')).rejects.toThrow('perfil en la web')
  expect(signOut).not.toHaveBeenCalled()
 })
 it('closes only the temporary verification session', async () => {
  signIn.mockResolvedValue({ data: { session: {} }, error: null })
  expect(await verifyCurrentPassword('a@example.test', 'fake')).toBe(true)
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
 })
})
