import { describe, it, expect } from 'vitest'
import { describeAuthError } from '@/lib/auth/auth-error-messages'
import { sanitizeRedirectPath } from '@/lib/auth/password-validation'

describe('auth audit regressions', () => {
 it('rejects control characters and backslashes in return destinations', () => {
  for (const path of ['/marketplace/\\evil.test', '/marketplace\nevil', '//evil.test']) expect(sanitizeRedirectPath(path, '/saas')).toBe('/saas')
 })
 it('translates password update failures without exposing the provider message', () => {
  expect(describeAuthError('Password is known to be weak and easy to guess', 'password')).toContain('contraseña')
  expect(describeAuthError('internal provider failure', 'password')).toBe('No pudimos cambiar tu contraseña. Intentá de nuevo.')
 })
})
