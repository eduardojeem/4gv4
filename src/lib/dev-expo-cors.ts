/**
 * Expo Web is served from localhost:8081 and calls the local Next API on :3000.
 * Keep this fixed-origin allowlist out of production builds and do not enable
 * credentialed cross-origin requests; the mobile client authenticates with a
 * bearer token.
 */
export function getExpoWebDevCorsHeaders(nodeEnvironment = process.env.NODE_ENV) {
  if (nodeEnvironment === 'production') return [];

  return [
    { key: 'Access-Control-Allow-Origin', value: 'http://localhost:8081' },
    { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS' },
    { key: 'Access-Control-Allow-Headers', value: 'Accept, Content-Type, Authorization, x-branch-id, x-organization-id, x-idempotency-key' },
    { key: 'Access-Control-Max-Age', value: '600' },
    { key: 'Vary', value: 'Origin' },
  ];
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
}

export function getDevLocalSupabaseOrigins({
  nodeEnvironment = process.env.NODE_ENV,
  appSupabaseUrl,
  mobileSupabaseUrl,
}: {
  nodeEnvironment?: string
  appSupabaseUrl?: string
  mobileSupabaseUrl?: string
}): string[] {
  if (nodeEnvironment === 'production') return []

  const origins = new Set<string>()
  for (const value of [appSupabaseUrl, mobileSupabaseUrl]) {
    if (!value) continue
    try {
      const url = new URL(value)
      const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
      const isLocalHost = hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.')
      if (url.protocol !== 'http:' || url.port !== '55321' || url.username || url.password
        || url.pathname !== '/' && url.pathname !== '' || url.search || url.hash
        || (!isLocalHost && !isPrivateIpv4(hostname))) {
        continue
      }
      origins.add(url.origin)
    } catch {
      // Una URL inválida no puede ampliar el permiso del CSP.
    }
  }
  return [...origins]
}
