import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

function sanitizeRedirect(value: string | null, fallback: string): string {
  if (!value) return fallback
  // Must start with exactly one slash, no protocol-relative or backslash tricks
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  // Block protocol injection (e.g. /javascript:...)
  const firstSlash = value.indexOf('/', 1)
  const segment = firstSlash > 0 ? value.slice(0, firstSlash) : value
  if (segment.includes(':')) return fallback
  return value
}

// Build an absolute redirect URL honouring proxies (Vercel) and local dev.
function buildRedirect(request: NextRequest, origin: string, next: string): NextResponse {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocal = process.env.NODE_ENV === 'development'

  if (!isLocal && forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`)
  }
  return NextResponse.redirect(`${origin}${next}`)
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  // Server-generated links (inviteUserByEmail / admin.generateLink) come back as
  // token_hash + type instead of a PKCE code, because there is no code verifier
  // in the recipient's browser.
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null

  const next = sanitizeRedirect(requestUrl.searchParams.get('next'), '/dashboard')

  const supabase = await createClient()

  // 1) PKCE flow (resetPasswordForEmail / signUp desde el navegador) → ?code=
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return buildRedirect(request, requestUrl.origin, next)
    }
    console.error('[auth/callback] exchangeCodeForSession failed', {
      message: error.message,
      status: error.status,
    })
  }

  // 2) Token-hash flow (invitaciones / recovery generados en el servidor) → ?token_hash=&type=
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      return buildRedirect(request, requestUrl.origin, next)
    }
    console.error('[auth/callback] verifyOtp failed', {
      type,
      message: error.message,
      status: error.status,
    })
  }

  // Diagnóstico: qué parámetros llegaron realmente al callback.
  console.error('[auth/callback] no valid auth params', {
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    type,
    paramKeys: Array.from(requestUrl.searchParams.keys()),
  })

  // Si hay error o no hay código/token, redirigir a login
  return NextResponse.redirect(new URL('/login?error=auth_callback_error', request.url))
}
