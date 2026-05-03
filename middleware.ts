
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

const ADMIN_PATH = /^\/admin(\/|$)/
const DASHBOARD_PATH = /^\/dashboard(\/|$)/
const PROTECTED_USER_PATHS = [/^\/perfil\/creditos(\/|$)/]

/** Roles allowed to access /dashboard */
const DASHBOARD_ROLES = ['admin', 'super_admin', 'vendedor', 'tecnico']

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isAdminPath = ADMIN_PATH.test(path)
  const isDashboardPath = DASHBOARD_PATH.test(path)
  const isProtectedUserPath = PROTECTED_USER_PATHS.some(p => p.test(path))

  if (!isAdminPath && !isDashboardPath && !isProtectedUserPath) {
    return NextResponse.next()
  }

  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() valida el JWT contra Supabase (más seguro que getSession)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user || error) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si es ruta de usuario protegida y ya tenemos usuario, permitimos el acceso
  if (isProtectedUserPath) {
    return res
  }

  // user_roles es la única fuente de verdad para privilegios
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  // Verificar estado del perfil
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .maybeSingle()

  const role = roleRow?.role
  const roleIsActive = roleRow?.is_active !== false
  const profileIsActive = !profileRow?.status || profileRow.status === 'active'

  // Dashboard: requiere rol de staff (admin, vendedor, tecnico)
  if (isDashboardPath) {
    const hasAccess = role && DASHBOARD_ROLES.includes(role) && roleIsActive && profileIsActive
    if (!hasAccess) {
      return NextResponse.redirect(new URL('/inicio', req.url))
    }
    return res
  }

  // Admin: requiere rol admin o super_admin
  if (isAdminPath) {
    const isAdmin = role === 'admin' || role === 'super_admin'

    if (!isAdmin || !roleIsActive || !profileIsActive) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/perfil/creditos/:path*'],
}
