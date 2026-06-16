import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
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
    // Rate limit por IP para evitar spam/flooding del log de seguridad.
    const clientIp = getClientIp(request)
    if (!rateLimiter.check(clientIp, 30, 60_000)) {
      return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 })
    }

    const body = (await request.json()) as AuthEventPayload

    if (!body.action || !ALLOWED_ACTIONS.has(body.action)) {
      return NextResponse.json({ ok: false, error: 'Invalid auth event action' }, { status: 400 })
    }

    let supabase: ReturnType<typeof createAdminSupabase>
    try {
      supabase = createAdminSupabase()
    } catch {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { data, error } = await supabase.rpc('log_auth_event', {
      p_user_id: body.userId ?? null,
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
