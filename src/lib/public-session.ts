/**
 * Public Session Management
 * Handles temporary JWT tokens for public portal access
 */

import { SignJWT, jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(
  process.env.PUBLIC_SESSION_SECRET || 'your-secret-key-change-in-production'
)

export interface PublicSessionPayload {
  repairId: string
  ticketNumber: string
  contact: string
  [key: string]: unknown
}

/**
 * Generate a temporary JWT token for public repair viewing
 * @param payload - Session data
 * @param expiresInSeconds - Token lifetime (default: 30 minutes)
 */
export async function generatePublicToken(
  payload: PublicSessionPayload,
  expiresInSeconds: number = 30 * 60
): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(SECRET_KEY)

  return token
}

/**
 * Verify and decode a public session token
 * @param token - JWT token to verify
 * @returns Payload if valid, null if invalid/expired
 */
export async function verifyPublicToken(
  token: string
): Promise<PublicSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload as unknown as PublicSessionPayload
  } catch {
    return null
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}
