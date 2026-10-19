import { describe, expect, it } from 'vitest'
import { defaultPasskeyLabel, describePasskeyError, isPasskeyCancellation } from './passkeys'

describe('describePasskeyError', () => {
  it.each([
    ['webauthn_challenge_expired', /venció/],
    ['webauthn_challenge_not_found', /venció o ya se usó/],
    ['webauthn_credential_not_found', /no está registrada/],
    ['webauthn_verification_failed', /No pudimos verificar/],
    ['passkey_disabled', /no está habilitado/],
    ['webauthn_credential_exists', /ya está registrado/],
    ['too_many_passkeys', /máximo/],
  ])('traduce %s', (code, expected) => {
    expect(describePasskeyError({ code, message: code })).toMatch(expected)
  })

  it('reconoce el error de dominio del navegador', () => {
    expect(describePasskeyError({ cause: { name: 'SecurityError' } })).toMatch(/dominio/)
  })

  it('tiene un mensaje genérico para lo desconocido', () => {
    expect(describePasskeyError(new Error('boom'))).toMatch(/usá tu contraseña/)
    expect(describePasskeyError(null)).toMatch(/usá tu contraseña/)
  })
})

describe('isPasskeyCancellation', () => {
  it('detecta la cancelación del diálogo', () => {
    expect(isPasskeyCancellation({ code: 'ERROR_CEREMONY_ABORTED' })).toBe(true)
    expect(isPasskeyCancellation({ cause: { name: 'NotAllowedError' } })).toBe(true)
    expect(isPasskeyCancellation({ code: 'webauthn_challenge_expired' })).toBe(false)
  })
})

describe('defaultPasskeyLabel', () => {
  it('arma sistema y navegador', () => {
    expect(
      defaultPasskeyLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36')
    ).toBe('Windows · Chrome')
    expect(
      defaultPasskeyLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
    ).toBe('iPhone · Safari')
    expect(defaultPasskeyLabel('')).toBe('Este dispositivo')
  })
})
