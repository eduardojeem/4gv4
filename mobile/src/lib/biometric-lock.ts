import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * Desbloqueo con Face ID / huella.
 *
 * No guarda la contraseña: la sesión de Supabase ya está cifrada en el llavero
 * del teléfono (ver secure-storage.ts). Face ID sólo decide si la app la muestra
 * al abrirse o al volver de segundo plano. Si falla, queda «Usar contraseña»,
 * que cierra la sesión y vuelve al login.
 */

export const BIOMETRIC_KEYS = {
  ENABLED: 'mt_unlock_biometric',
  OFFERED: 'mt_unlock_biometric_offered',
} as const;

/** Tiempo en segundo plano a partir del cual se vuelve a pedir Face ID. */
export const RELOCK_AFTER_MS = 60_000;

export type BiometricSupport = { available: boolean; label: string };

/** Nombre que entiende la persona según lo que tenga el teléfono. */
export function biometricLabel(types: readonly number[], platform: string): string {
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  if (platform === 'ios') return face ? 'Face ID' : finger ? 'Touch ID' : 'Face ID';
  if (finger) return 'huella';
  if (face) return 'reconocimiento facial';
  return 'huella';
}

/** ¿Hay que pedir Face ID al volver de segundo plano? */
export function shouldRelock(backgroundedAt: number | null, now: number): boolean {
  return backgroundedAt !== null && now - backgroundedAt >= RELOCK_AFTER_MS;
}

export async function getBiometricSupport(platform: string): Promise<BiometricSupport> {
  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return { available: hardware && enrolled, label: biometricLabel(types, platform) };
  } catch {
    return { available: false, label: biometricLabel([], platform) };
  }
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(BIOMETRIC_KEYS.ENABLED)) === 'true';
  } catch {
    return false;
  }
}

export async function setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
  if (enabled) await SecureStore.setItemAsync(BIOMETRIC_KEYS.ENABLED, 'true');
  else await SecureStore.deleteItemAsync(BIOMETRIC_KEYS.ENABLED);
  await SecureStore.setItemAsync(BIOMETRIC_KEYS.OFFERED, 'true');
}

/** Se ofrece una sola vez por teléfono, después del primer login. */
export async function wasBiometricUnlockOffered(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(BIOMETRIC_KEYS.OFFERED)) === 'true';
  } catch {
    return true;
  }
}

/** Al cerrar sesión se apaga: el próximo que entre en este teléfono decide de nuevo. */
export async function clearBiometricUnlock(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(BIOMETRIC_KEYS.ENABLED),
    SecureStore.deleteItemAsync(BIOMETRIC_KEYS.OFFERED),
  ]).catch(() => undefined);
}

export async function authenticateWithBiometrics(label: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Desbloqueá Mi TiendaPy con ${label}`,
      cancelLabel: 'Cancelar',
      // En iOS deja usar el código del teléfono si Face ID no reconoce.
      fallbackLabel: 'Usar código',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
