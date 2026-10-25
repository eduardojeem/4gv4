export const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
} as const

export async function hasHardwareAsync() {
  return false
}

export async function isEnrolledAsync() {
  return false
}

export async function supportedAuthenticationTypesAsync() {
  return [] as number[]
}

export async function authenticateAsync() {
  return { success: false }
}
