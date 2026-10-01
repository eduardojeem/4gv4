import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'

type AuthEventAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'password_change'
  | 'role_change'
  | 'permission_denied'
  | 'suspicious_activity'

type AuthEventPayload = {
  userId?: string | null
  action?: AuthEventAction
  success?: boolean
  ipAddress?: string | null
  userAgent?: string | null
  details?: Record<string, unknown>
}

const ALLOWED_ACTIONS = new Set<AuthEventAction>([
  'login',
  'login_failed',
  'logout',
  'password_change',
  'role_change',
  'permission_denied',
  'suspicious_activity',
])

export async function POST(request: NextRequest) {
  try {
    // health-anonymous-write: login_failed se registra antes de que exista sesión.
    // Rate limit por IP para evitar spam/flooding del log de seguridad.
    const clientIp = getClientIp(request)
    if (!(await rateLimiter.check(`auth-events:${clientIp}`, 30, 60_000))) {
      return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 })
    }

    const body = (await request.json()) as AuthEventPayload

    if (!body.action || !ALLOWED_ACTIONS.has(body.action)) {
      return NextResponse.json({ ok: false, error: 'Invalid auth event action' }, { status: 400 })
    }

    const auth = await createServerSupabase()
    const { data: { user: authenticatedUser } } = await auth.auth.getUser()
    if (!authenticatedUser && body.action !== 'login_failed') {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
    }

    let supabase: ReturnType<typeof createAdminSupabase>
    try {
      supabase = createAdminSupabase()
    } catch {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { data, error } = await supabase.rpc('log_auth_event', {
      // Nunca confiar en el userId enviado por el navegador: un cliente podía
      // atribuir eventos a otra persona. Los fallos de login son anónimos.
      p_user_id: authenticatedUser?.id ?? null,
      p_action: body.action,
      p_success: body.success ?? true,
      p_ip_address: clientIp,
      p_user_agent: request.headers.get('user-agent'),
      p_details: body.details ?? {},
    })

    if (error) {
      console.error('Auth event API failed:', error)
      const message = String(error.message || '').toLowerCase()
      if (message.includes('function') || message.includes('log_auth_event') || message.includes('does not exist')) {
        return NextResponse.json({ ok: true, skipped: true })
      }
      return NextResponse.json({ ok: false, error: 'Failed to log auth event' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data ?? null })
  } catch (error) {
    console.error('Auth event API route error:', error)
    return NextResponse.json({ ok: false, error: 'Unexpected error' }, { status: 500 })
  }
}
