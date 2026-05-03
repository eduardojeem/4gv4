/**
 * Shared password validation for register and reset-password flows.
 */

export interface PasswordCheck {
  ok: boolean
  label: string
}

/** Returns an error message if the password is invalid, or null if valid. */
export function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (!/[A-Z]/.test(pwd)) return 'La contraseña debe contener al menos una mayúscula'
  if (!/[a-z]/.test(pwd)) return 'La contraseña debe contener al menos una minúscula'
  if (!/[0-9]/.test(pwd)) return 'La contraseña debe contener al menos un número'
  return null
}

/** Returns the checklist items for a password strength indicator. */
export function getPasswordChecks(pwd: string): PasswordCheck[] {
  return [
    { ok: pwd.length >= 8, label: 'Mínimo 8 caracteres' },
    { ok: /[A-Z]/.test(pwd), label: 'Una letra mayúscula' },
    { ok: /[a-z]/.test(pwd), label: 'Una letra minúscula' },
    { ok: /[0-9]/.test(pwd), label: 'Un número' },
  ]
}

/**
 * Validate a redirect path to prevent open-redirect attacks.
 * Only allows relative paths on the same origin.
 */
export function sanitizeRedirectPath(path: string | null | undefined, fallback = '/dashboard'): string {
  if (!path) return fallback
  // Must start with exactly one slash and not be a protocol-relative URL
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback
  // Block any path that contains a colon before the first slash (protocol injection)
  const firstSlash = path.indexOf('/', 1)
  const segment = firstSlash > 0 ? path.slice(0, firstSlash) : path
  if (segment.includes(':')) return fallback
  return path
}

/**
 * Validate an email address.
 * Stricter than the basic `.+@.+\..+` regex — checks for:
 * - Non-empty local part (before @)
 * - Non-empty domain with at least one dot
 * - TLD of at least 2 characters
 * - No spaces or invalid characters
 * - Max 254 characters (RFC 5321)
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false
  // Standard HTML5 email regex aligned with the spec, plus TLD length check
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(email)
}
