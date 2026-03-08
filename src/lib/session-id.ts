export async function getSessionIdFromAccessToken(accessToken?: string | null): Promise<string | null> {
  if (!accessToken) return null

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(accessToken)
      const digest = await crypto.subtle.digest('SHA-256', data)
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }
  } catch {
    // Ignore and fallback below.
  }

  // Fallback hash for environments without Web Crypto.
  let hash = 0
  for (let i = 0; i < accessToken.length; i += 1) {
    hash = (hash << 5) - hash + accessToken.charCodeAt(i)
    hash |= 0
  }
  return `sid_${Math.abs(hash)}_${accessToken.length}`
}
