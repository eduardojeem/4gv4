import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => new Map<string, string>())
const local = vi.hoisted(() => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  supportedAuthenticationTypesAsync: vi.fn(),
  authenticateAsync: vi.fn(),
}))

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => void store.set(key, value)),
  deleteItemAsync: vi.fn(async (key: string) => void store.delete(key)),
}))

vi.mock('expo-local-authentication', () => ({
  ...local,
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}))

import {
  BIOMETRIC_KEYS,
  RELOCK_AFTER_MS,
  authenticateWithBiometrics,
  biometricLabel,
  clearBiometricUnlock,
  getBiometricSupport,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
  shouldRelock,
  wasBiometricUnlockOffered,
} from '../../mobile/src/lib/biometric-lock'

beforeEach(() => {
  store.clear()
  vi.clearAllMocks()
})

describe('desbloqueo con Face ID / huella en la app', () => {
  it('nombra el método según el teléfono', () => {
    expect(biometricLabel([2], 'ios')).toBe('Face ID')
    expect(biometricLabel([1], 'ios')).toBe('Touch ID')
    expect(biometricLabel([1], 'android')).toBe('huella')
    expect(biometricLabel([2], 'android')).toBe('reconocimiento facial')
  })

  it('solo está disponible con hardware y algo registrado en el teléfono', async () => {
    local.hasHardwareAsync.mockResolvedValue(true)
    local.isEnrolledAsync.mockResolvedValue(false)
    local.supportedAuthenticationTypesAsync.mockResolvedValue([2])
    expect(await getBiometricSupport('ios')).toEqual({ available: false, label: 'Face ID' })

    local.isEnrolledAsync.mockResolvedValue(true)
    expect(await getBiometricSupport('ios')).toEqual({ available: true, label: 'Face ID' })
  })

  it('guarda solo la preferencia, nunca la contraseña', async () => {
    expect(await isBiometricUnlockEnabled()).toBe(false)
    expect(await wasBiometricUnlockOffered()).toBe(false)

    await setBiometricUnlockEnabled(true)
    expect(await isBiometricUnlockEnabled()).toBe(true)
    expect(await wasBiometricUnlockOffered()).toBe(true)
    expect([...store.keys()].sort()).toEqual([BIOMETRIC_KEYS.ENABLED, BIOMETRIC_KEYS.OFFERED].sort())
    expect([...store.values()]).toEqual(['true', 'true'])
  })

  it('«Ahora no» no lo activa pero no lo vuelve a ofrecer', async () => {
    await setBiometricUnlockEnabled(false)
    expect(await isBiometricUnlockEnabled()).toBe(false)
    expect(await wasBiometricUnlockOffered()).toBe(true)
  })

  it('al cerrar sesión se borra todo', async () => {
    await setBiometricUnlockEnabled(true)
    await clearBiometricUnlock()
    expect(store.size).toBe(0)
  })

  it('vuelve a pedir Face ID solo después de un rato en segundo plano', () => {
    expect(shouldRelock(null, 10_000)).toBe(false)
    expect(shouldRelock(0, RELOCK_AFTER_MS - 1)).toBe(false)
    expect(shouldRelock(0, RELOCK_AFTER_MS)).toBe(true)
  })

  it('un error o una cancelación no desbloquean', async () => {
    local.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' })
    expect(await authenticateWithBiometrics('Face ID')).toBe(false)
    local.authenticateAsync.mockRejectedValueOnce(new Error('boom'))
    expect(await authenticateWithBiometrics('Face ID')).toBe(false)
    local.authenticateAsync.mockResolvedValueOnce({ success: true })
    expect(await authenticateWithBiometrics('Face ID')).toBe(true)
    expect(local.authenticateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ promptMessage: 'Desbloqueá Mi Tienda con Face ID', disableDeviceFallback: false })
    )
  })
})
