type TurnstileResult =
  | { success: true; bypassed?: true }
  | { success: false; reason: 'missing_token' | 'not_configured' | 'rejected' | 'unavailable' }

type TurnstileResponse = {
  success?: boolean
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()

  if (!secret) {
    if (process.env.NODE_ENV !== 'production') return { success: true, bypassed: true }
    return { success: false, reason: 'not_configured' }
  }
  if (!token?.trim()) return { success: false, reason: 'missing_token' }

  const body = new URLSearchParams({ secret, response: token.trim() })
  if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp)

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return { success: false, reason: 'unavailable' }
    const data = await response.json() as TurnstileResponse
    return data.success ? { success: true } : { success: false, reason: 'rejected' }
  } catch {
    return { success: false, reason: 'unavailable' }
  }
}
