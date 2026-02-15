/**
 * Google reCAPTCHA v3 Verification
 */

export interface RecaptchaVerificationResult {
  success: boolean
  score: number
  action: string
  challenge_ts: string
  hostname: string
  'error-codes'?: string[]
}

/**
 * Verify reCAPTCHA token with Google
 * @param token - Token from client
 * @param expectedAction - Expected action name
 * @param minScore - Minimum score threshold (0.0 - 1.0)
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction: string = 'repair_auth',
  minScore: number = 0.5
): Promise<{ valid: boolean; score?: number; error?: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY

  if (!secretKey) {
    // In development, allow bypass if key is missing
    if (process.env.NODE_ENV === 'development') {
      console.warn('Bypassing reCAPTCHA verification because RECAPTCHA_SECRET_KEY is missing')
      return { valid: true, score: 1.0 }
    }
    console.error('RECAPTCHA_SECRET_KEY not configured')
    return { valid: false, error: 'reCAPTCHA not configured' }
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    })

    const data: RecaptchaVerificationResult = await response.json()

    if (!data.success) {
      return {
        valid: false,
        error: `reCAPTCHA verification failed: ${data['error-codes']?.join(', ') || 'unknown error'}`,
      }
    }

    // Check action matches
    if (data.action !== expectedAction) {
      return {
        valid: false,
        score: data.score,
        error: `Action mismatch: expected ${expectedAction}, got ${data.action}`,
      }
    }

    // Check score threshold
    if (data.score < minScore) {
      return {
        valid: false,
        score: data.score,
        error: `Score too low: ${data.score} < ${minScore}`,
      }
    }

    return {
      valid: true,
      score: data.score,
    }
  } catch (error) {
    console.error('reCAPTCHA verification error:', error)
    return {
      valid: false,
      error: 'Failed to verify reCAPTCHA',
    }
  }
}
