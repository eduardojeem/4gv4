import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  const next = sanitizeRedirect(requestUrl.searchParams.get('next'), '/dashboard')

  if (code) {
    const supabase = await createClient()
    
    // Intercambiar el código por una sesión
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Redirigir a la URL solicitada usando la URL base de la solicitud
      const forwardedHost = request.headers.get('x-forwarded-host') // Para deployments tras proxy
      const isLocal = process.env.NODE_ENV === 'development'
      
      if (isLocal) {
        return NextResponse.redirect(`${requestUrl.origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${requestUrl.origin}${next}`)
      }
    }
  }

  // Si hay error o no hay código, redirigir a login
  return NextResponse.redirect(new URL('/login?error=auth_callback_error', request.url))
}
