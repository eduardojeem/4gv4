/**
 * Sesiones reales del usuario (Supabase Auth, `auth.sessions`) para Perfil →
 * Seguridad. Las filas vienen de `public.list_my_auth_sessions()`; acá se
 * traducen a lo que muestra la pantalla y se marca la sesión de este equipo con
 * el claim `session_id` del token, que no cambia al renovarse.
 */

export type AuthSessionRow = {
  id: string
  created_at: string | null
  last_active_at: string | null
  user_agent: string | null
  ip: string | null
  aal: string | null
}

export type SessionRecord = {
  id: string
  session_id: string
  user_agent: string
  ip_address: string
  device_type: 'desktop' | 'mobile' | 'tablet'
  browser: string
  os: string
  created_at: string
  last_activity: string
  is_current: boolean
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
}

/** `session_id` del token de acceso: identifica la sesión de este equipo. No valida la firma. */
export function readTokenSessionId(token: string | null | undefined): string | null {
  const payload = token?.split('.')[1]
  if (!payload) return null
  try {
    const { session_id: sessionId } = JSON.parse(decodeBase64Url(payload)) as { session_id?: unknown }
    return typeof sessionId === 'string' && sessionId ? sessionId : null
  } catch {
    return null
  }
}

/** Navegador, sistema y tipo de equipo a partir del user agent que guardó Supabase Auth. */
export function parseUserAgent(ua: string): { browser: string; os: string; deviceType: SessionRecord['device_type'] } {
  const isApp = /okhttp|CFNetwork|Expo|Dalvik/i.test(ua)

  let browser = 'Navegador desconocido'
  if (isApp) browser = 'App MiTiendaPy'
  else if (ua.includes('Edg/')) browser = 'Microsoft Edge'
  else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera'
  else if (ua.includes('Firefox/')) browser = 'Firefox'
  else if (ua.includes('Brave')) browser = 'Brave'
  else if (ua.includes('Chrome/')) browser = 'Chrome'
  else if (ua.includes('Safari/')) browser = 'Safari'

  let os = 'Sistema desconocido'
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11'
  else if (ua.includes('Windows')) os = 'Windows'
  else if (/iPhone|iPad|iOS|CFNetwork|Darwin/.test(ua) && !ua.includes('Macintosh')) os = 'iOS'
  else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'macOS'
  else if (/Android|okhttp|Dalvik/i.test(ua)) os = 'Android'
  else if (ua.includes('Linux')) os = 'Linux'

  let deviceType: SessionRecord['device_type'] = 'desktop'
  if (/iPad|Tablet/i.test(ua)) deviceType = 'tablet'
  else if (isApp || /Mobile|Android|iPhone|iPod/i.test(ua)) deviceType = 'mobile'

  return { browser, os, deviceType }
}

export function toSessionRecords(rows: AuthSessionRow[], currentSessionId: string | null): SessionRecord[] {
  return rows.map((row) => {
    const ua = row.user_agent ?? ''
    const { browser, os, deviceType } = parseUserAgent(ua)
    const createdAt = row.created_at ?? ''
    return {
      id: row.id,
      session_id: row.id,
      user_agent: ua,
      ip_address: row.ip || 'IP no disponible',
      device_type: deviceType,
      browser,
      os,
      created_at: createdAt,
      last_activity: row.last_active_at ?? createdAt,
      is_current: Boolean(currentSessionId && row.id === currentSessionId),
    }
  })
}
