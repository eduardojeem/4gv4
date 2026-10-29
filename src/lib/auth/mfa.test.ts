import { describe, expect, it } from 'vitest'
import {
  buildMfaPath,
  describeMfaError,
  hasVerifiedFactor,
  isCompleteTotpCode,
  isMfaPending,
  needsAdminMfaEnrollment,
  normalizeTotpCode,
  readTokenAal,
} from './mfa'

function fakeToken(claims: Record<string, unknown>) {
  return ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'firma'].join('.')
}

const verified = { factors: [{ status: 'verified', factor_type: 'totp' }] }
const unverified = { factors: [{ status: 'unverified', factor_type: 'totp' }] }

describe('regla de 2FA', () => {
  it('lee el nivel de la sesión del token', () => {
    expect(readTokenAal(fakeToken({ aal: 'aal1' }))).toBe('aal1')
    expect(readTokenAal(fakeToken({ aal: 'aal2' }))).toBe('aal2')
    expect(readTokenAal(fakeToken({ aal: 'aal3' }))).toBeNull()
    expect(readTokenAal('no-es-un-token')).toBeNull()
    expect(readTokenAal(undefined)).toBeNull()
  })

  it('una activación a medias no cuenta como 2FA activa', () => {
    expect(hasVerifiedFactor(verified)).toBe(true)
    expect(hasVerifiedFactor(unverified)).toBe(false)
    expect(hasVerifiedFactor({ factors: null })).toBe(false)
    expect(hasVerifiedFactor(null)).toBe(false)
  })

  it('con 2FA activa sólo una sesión aal2 queda completa', () => {
    expect(isMfaPending(verified, 'aal1')).toBe(true)
    expect(isMfaPending(verified, null)).toBe(true)
    expect(isMfaPending(verified, 'aal2')).toBe(false)
    // Sin 2FA no se le pide nada a nadie.
    expect(isMfaPending(unverified, 'aal1')).toBe(false)
    expect(isMfaPending({}, 'aal1')).toBe(false)
  })

  it('la exigencia de la organización alcanza sólo a dueños y administradores sin aal2', () => {
    const base = { requireAdminMfa: true, aal: 'aal1' as const }
    expect(needsAdminMfaEnrollment({ ...base, organizationRole: 'owner' })).toBe(true)
    expect(needsAdminMfaEnrollment({ ...base, organizationRole: 'admin' })).toBe(true)
    expect(needsAdminMfaEnrollment({ ...base, organizationRole: 'cashier' })).toBe(false)
    expect(needsAdminMfaEnrollment({ ...base, organizationRole: undefined })).toBe(false)
    expect(needsAdminMfaEnrollment({ ...base, organizationRole: 'owner', aal: 'aal2' })).toBe(false)
    expect(needsAdminMfaEnrollment({ ...base, organizationRole: 'owner', requireAdminMfa: false })).toBe(false)
  })

  it('arma la ruta del segundo paso conservando a dónde iba', () => {
    expect(buildMfaPath('/dashboard/pos?tab=1')).toBe('/auth/mfa?redirect=%2Fdashboard%2Fpos%3Ftab%3D1')
    expect(buildMfaPath('/admin', { setup: true })).toBe('/auth/mfa?setup=1&redirect=%2Fadmin')
    expect(buildMfaPath(null)).toBe('/auth/mfa')
    expect(buildMfaPath('/auth/mfa')).toBe('/auth/mfa')
  })

  it('normaliza el código como lo muestran las apps', () => {
    expect(normalizeTotpCode('123 456')).toBe('123456')
    expect(normalizeTotpCode('12-34-56-78')).toBe('123456')
    expect(isCompleteTotpCode('123456')).toBe(true)
    expect(isCompleteTotpCode('12345')).toBe(false)
  })

  it('traduce los errores de Supabase', () => {
    expect(describeMfaError({ code: 'mfa_verification_failed' })).toMatch(/no es correcto/)
    expect(describeMfaError({ message: 'Invalid TOTP code entered' })).toMatch(/no es correcto/)
    expect(describeMfaError({ code: 'insufficient_aal' })).toMatch(/primero confirmá tu sesión/)
    expect(describeMfaError(new Error('rara'))).toMatch(/Intentá de nuevo/)
  })
})
