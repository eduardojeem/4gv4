import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { normalizeRole } from '@/lib/auth/role-utils'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Demo mode - skip authentication if Supabase is not configured
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your_supabase_project_url') {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Clasificar la ruta
  const pathname = request.nextUrl.pathname
  const isProtectedRoute = pathname.startsWith('/dashboard')
  const isAdminRoute = pathname.startsWith('/admin')
  const isAuthRoute = pathname === '/login' || pathname === '/register'

  // Solo hacer auth check si la ruta lo requiere
  if (!isProtectedRoute && !isAdminRoute && !isAuthRoute) {
    return supabaseResponse
  }

  // Verificar autenticacion (una sola vez)
  let user = null
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    user = authUser
  } catch {
    // Si falla la conexion, asumimos sin usuario
  }

  // Obtener rol del usuario (una sola query) - solo si esta autenticado y lo necesitamos
  let normalizedRole: string | undefined
  if (user) {
    try {
      // Una sola query a user_roles (fuente de verdad para roles)
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      const rawRole = (roleRow?.role as string | undefined)
        // Fallback a profiles solo si user_roles no tiene dato
        || (await getProfileRole(supabase, user.id))

      normalizedRole = normalizeRole(rawRole)
    } catch {
      normalizedRole = undefined
    }
  }

  const effectiveRole = normalizedRole ?? 'cliente'
  const isClientOrViewer = effectiveRole === 'cliente'
  const isAdmin = effectiveRole === 'admin'

  // Rutas protegidas (dashboard) - requieren autenticacion y rol no-cliente
  if (isProtectedRoute && (!user || isClientOrViewer)) {
    return NextResponse.redirect(new URL('/inicio', request.url))
  }

  // Rutas admin - requieren autenticacion y rol admin
  if (isAdminRoute) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/inicio', request.url))
    }
  }

  // Si ya autenticado y en ruta de auth, redirigir segun rol
  if (isAuthRoute && user) {
    const target = isClientOrViewer ? '/inicio' : '/dashboard'
    return NextResponse.redirect(new URL(target, request.url))
  }

  return supabaseResponse
}

/**
 * Fallback: obtener rol de la tabla profiles solo si user_roles no tiene dato.
 */
async function getProfileRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<string | undefined> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (typeof profile === 'object' && profile && 'role' in profile) {
      return (profile as { role?: string | null }).role ?? undefined
    }
  } catch {
    // silenciar
  }
  return undefined
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/dashboard/:path*',
    '/admin/:path*',
  ],
}
