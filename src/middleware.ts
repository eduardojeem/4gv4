import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { normalizeRole } from '@/lib/auth/role-utils'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Demo mode - skip authentication if Supabase is not configured
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your_supabase_project_url') {
    // In demo mode, allow access to all routes
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verificar si el usuario está autenticado de forma segura
  let user = null
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser
  } catch (error) {
    // Si falla la conexión con Supabase (ej. fetch failed), asumimos que no hay usuario
    // Esto evita que el middleware crashee completamente en entornos de desarrollo inestables
    logger.error('Middleware auth connection failed', { error })
  }

  // Rutas protegidas que requieren autenticación y rol adecuado
  const protectedRoutes = ['/dashboard']
  const authRoutes = ['/login', '/register']

  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )
  const isAuthRoute = authRoutes.includes(request.nextUrl.pathname)
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  // Obtener rol del usuario si está autenticado
  let normalizedRole: string | undefined = undefined
  if (user) {
    try {
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      const userRolesRole = roleRow?.role as string | undefined

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const profileRole = typeof profile === 'object' && profile && 'role' in profile
        ? (profile as { role?: string | null }).role
        : undefined

      const meta = (user as unknown as { user_metadata?: Record<string, unknown> }).user_metadata
      const metaRole = typeof meta?.role === 'string' ? (meta.role as string) : undefined

      // Prefer profiles for client classification; fallback to user_roles, then metadata
      const normalizedProfile = normalizeRole(profileRole)
      const normalizedUserRoles = normalizeRole(userRolesRole)
      const normalizedMeta = normalizeRole(metaRole)
      normalizedRole = normalizedProfile ?? normalizedUserRoles ?? normalizedMeta
    } catch (e) {
      normalizedRole = undefined
    }
  }

  // Si está en una ruta protegida y no está autenticado o es cliente (normal o mayorista) o viewer, redirigir a inicio
  const effectiveRole = normalizedRole ?? 'cliente'
  const isClientRole = effectiveRole === 'cliente'
  if (isProtectedRoute && (!user || isClientRole || normalizedRole === 'viewer')) {
    return NextResponse.redirect(new URL('/inicio', request.url))
  }

  if (isAdminRoute) {
    if (!user) {
      logger.warn('Admin route access denied - not authenticated', {
        path: request.nextUrl.pathname
      })
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      // Try to get role from user_roles table
      const { data: roleRow, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      let role = roleRow?.role as string | undefined

      // If not found, try profiles table
      if (!role) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        const profileRole =
          typeof profile === 'object' && profile && 'role' in profile
            ? (profile as { role?: string | null }).role
            : undefined
        role = typeof profileRole === 'string' ? profileRole : role
      }

      // If still not found, try user metadata
      if (!role) {
        const meta = (user as unknown as { user_metadata?: Record<string, unknown> }).user_metadata
        const metaRole = typeof meta?.role === 'string' ? (meta.role as string) : undefined
        role = metaRole ?? role
      }

      // Normalize and check role
      const normalized = typeof role === 'string' ? role.toLowerCase().trim() : undefined

      // Allow access for admin, super_admin, or if in demo mode (no role found but user is authenticated)
      const allowed = normalized === 'admin' || normalized === 'super_admin'

      if (!allowed) {
        logger.warn('Admin route access denied - insufficient permissions', {
          userId: user.id,
          role: normalized || 'none',
          path: request.nextUrl.pathname
        })
        return NextResponse.redirect(new URL('/inicio', request.url))
      }
    } catch (error) {
      logger.error('Admin access check failed', { error, userId: user.id })
      return NextResponse.redirect(new URL('/inicio', request.url))
    }
  }

  // Si está autenticado y trata de acceder a login/register, redirigir según rol
  if (isAuthRoute && user) {
    const effectiveRole = normalizedRole ?? 'cliente'
    const isClientRole = effectiveRole === 'cliente'
    const target = isClientRole ? '/inicio' : '/dashboard'
    return NextResponse.redirect(new URL(target, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/dashboard/:path*',
    '/admin/:path*',
  ],
}
