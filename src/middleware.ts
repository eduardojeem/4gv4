import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
    console.error('Middleware Auth Error:', error)
  }

  // Rutas protegidas que requieren autenticación
  const protectedRoutes = ['/dashboard']
  const authRoutes = ['/login', '/register']

  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )
  const isAuthRoute = authRoutes.includes(request.nextUrl.pathname)
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')

  // Si está en una ruta protegida y no está autenticado, redirigir a login
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAdminRoute) {
    if (!user) {
      console.log('🚫 Admin route access denied: No user authenticated')
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      console.log('🔍 Checking admin access for user:', user.id)

      // Try to get role from user_roles table
      const { data: roleRow, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      let role = roleRow?.role as string | undefined
      console.log('📋 Role from user_roles:', role, roleError ? `(error: ${roleError.message})` : '')

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
        console.log('📋 Role from profiles:', role, profileError ? `(error: ${profileError.message})` : '')
      }

      // If still not found, try user metadata
      if (!role) {
        const meta = (user as unknown as { user_metadata?: Record<string, unknown> }).user_metadata
        const metaRole = typeof meta?.role === 'string' ? (meta.role as string) : undefined
        role = metaRole ?? role
        console.log('📋 Role from metadata:', role)
      }

      // Normalize and check role
      const normalized = typeof role === 'string' ? role.toLowerCase().trim() : undefined
      console.log('🔑 Normalized role:', normalized)

      // Allow access for admin, super_admin, or if in demo mode (no role found but user is authenticated)
      const allowed = normalized === 'admin' || normalized === 'super_admin'

      if (!allowed) {
        console.log('🚫 Admin route access denied: User role is', normalized || 'undefined')
        console.log('💡 Tip: User needs "admin" or "super_admin" role. Current role:', role)
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      console.log('✅ Admin route access granted for user:', user.id)
    } catch (error) {
      console.error('💥 Error checking admin access:', error)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Si está autenticado y trata de acceder a login/register, redirigir al dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
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
  ],
}