export type AuthEventAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'password_change'
  | 'role_change'
  | 'permission_denied'
  | 'suspicious_activity'

export async function logAuthEventClient(input: {
  userId?: string | null
  action: AuthEventAction
  success?: boolean
  ipAddress?: string | null
  userAgent?: string | null
  details?: Record<string, unknown>
}): Promise<boolean> {
  try {
    const response = await fetch('/api/security/auth-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    return response.ok
  } catch {
    return false
  }
}
