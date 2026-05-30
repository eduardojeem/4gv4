import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { normalizeRole } from '@/lib/auth/role-utils'
import { getTenantSlugFromPath, getTenantSlugFromRequest } from '@/lib/saas/tenant'
import { ACTIVE_ORGANIZATION_COOKIE } from '@/lib/saas/active-organization'

const PROXY_AUTH_TIMEOUT_MS = 4000
const PROXY_PROFILE_TIMEOUT_MS = 3000
const DEFAULT_PUBLIC_ORG_SLUG = process.env.DEFAULT_PUBLIC_ORG_SLUG || 'default'
const LEGACY_PUBLIC_PATHS = ['/inicio', '/productos', '/mis-reparaciones']

function redirectLegacyPublicPath(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname === '/products' || pathname.startsWith('/products/')) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.replace(/^\/products/, '/dashboard/products')
    return NextResponse.redirect(url, 308)
  }

  const legacyPath = LEGACY_PUBLIC_PATHS.find((path) => pathname === path || pathname.startsWith(`${path}/`))

  if (!legacyPath) {
    return null
  }

  const url = request.nextUrl.clone()
  url.pathname = `/${DEFAULT_PUBLIC_ORG_SLUG}${pathname}`

  return NextResponse.redirect(url, 308)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function applyResponseCookies(target: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie)
  })

  return target
}

function redirectWithCookies(request: NextRequest, source: NextResponse, pathname: string): NextResponse {
  return applyResponseCookies(
    NextResponse.redirect(new URL(pathname, request.url)),
    source
  )
}

function rewriteForbiddenResponse(
  request: NextRequest,
  source: NextResponse,
  reason: 'admin' | 'dashboard'
): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = '/forbidden'
  url.search = ''
  url.searchParams.set('reason', reason)
  url.searchParams.set('from', `${request.nextUrl.pathname}${request.nextUrl.search}`)

  return applyResponseCookies(NextResponse.rewrite(url), source)
}

export async function proxy(request: NextRequest) {
  const legacyPublicRedirect = redirectLegacyPublicPath(request)
  if (legacyPublicRedirect) {
    return legacyPublicRedirect
  }

  const requestHeaders = new Headers(request.headers)
  const tenantSlug = getTenantSlugFromRequest(request) ?? getTenantSlugFromPath(request.nextUrl.pathname)

  if (tenantSlug) {
    requestHeaders.set('x-tenant-slug', tenantSlug)
  } else {
    const activeOrganizationId = request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value
    if (activeOrganizationId) {
      requestHeaders.set('x-organization-id', activeOrganizationId)
    }
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

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
        supabaseResponse = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
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
  const isSuperAdminRoute = pathname.startsWith('/superadmin')
  const isInternalOpsRoute = pathname.startsWith('/debug') || pathname === '/setup' || pathname === '/setup-access'
  const isAuthRoute = pathname === '/login' || pathname === '/register'

  // Solo hacer auth check si la ruta lo requiere
  if (!isProtectedRoute && !isAdminRoute && !isSuperAdminRoute && !isInternalOpsRoute && !isAuthRoute) {
    return supabaseResponse
  }

  // Verificar autenticacion (una sola vez)
  let user = null
  try {
    user = await withTimeout(
      supabase.auth
        .getUser()
        .then(({ data: { user: authUser } }) => authUser)
        .catch(() => null),
      PROXY_AUTH_TIMEOUT_MS,
      null
    )
  } catch {
    // Si falla la conexion, asumimos sin usuario
  }

  // Obtener rol del usuario (una sola query) - solo si esta autenticado y lo necesitamos
  let normalizedRole: string | undefined
  let roleIsActive = true
  let profileIsActive = true
  if (user) {
    try {
      const { data: roleWithStatus, error: roleWithStatusError } = await withTimeout<any>(
        Promise.resolve(supabase
          .from('user_roles')
          .select('role,is_active')
          .eq('user_id', user.id)
          .maybeSingle()),
        PROXY_PROFILE_TIMEOUT_MS,
        { data: null, error: null }
      )

      let rawRole = roleWithStatus?.role as string | undefined

      if (!roleWithStatusError) {
        roleIsActive = roleWithStatus?.is_active !== false
      } else if (roleWithStatusError.message?.includes('is_active')) {
        const { data: roleOnly } = await withTimeout<any>(
          Promise.resolve(supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle()),
          PROXY_PROFILE_TIMEOUT_MS,
          { data: null, error: null }
        )

        rawRole = roleOnly?.role as string | undefined
      }

      const profile = await withTimeout(
        getProfileState(supabase, user.id),
        PROXY_PROFILE_TIMEOUT_MS,
        {}
      )
      profileIsActive = !profile.status || profile.status === 'active'

      if (!rawRole) {
        rawRole = profile.role
      }

      normalizedRole = normalizeRole(rawRole)
    } catch {
      normalizedRole = undefined
      roleIsActive = true
      profileIsActive = true
    }
  }

  const effectiveRole = normalizedRole ?? 'cliente'
  const isActiveUser = roleIsActive && profileIsActive
  const isClientOrViewer = !isActiveUser || effectiveRole === 'cliente'
  const isAdmin = isActiveUser && (effectiveRole === 'admin' || effectiveRole === 'super_admin')
  const isSuperAdmin = isActiveUser && effectiveRole === 'super_admin'

  // Rutas protegidas (dashboard) - requieren autenticacion y rol no-cliente
  if (isProtectedRoute) {
    if (!user) {
      return redirectWithCookies(request, supabaseResponse, '/login')
    }

    if (isClientOrViewer) {
      return rewriteForbiddenResponse(request, supabaseResponse, 'dashboard')
    }
  }

  // Rutas admin - requieren autenticacion y rol admin/super_admin
  if (isAdminRoute) {
    if (!user) {
      return redirectWithCookies(request, supabaseResponse, '/login')
    }
    if (!isAdmin) {
      return rewriteForbiddenResponse(request, supabaseResponse, 'admin')
    }
  }

  if (isSuperAdminRoute || isInternalOpsRoute) {
    if (!user) {
      return redirectWithCookies(request, supabaseResponse, '/login')
    }
    if (!isSuperAdmin) {
      return rewriteForbiddenResponse(request, supabaseResponse, 'admin')
    }
  }

  // Si ya autenticado y en ruta de auth, redirigir segun rol
  if (isAuthRoute && user) {
    const target = isClientOrViewer ? `/${DEFAULT_PUBLIC_ORG_SLUG}/inicio` : '/dashboard'
    return redirectWithCookies(request, supabaseResponse, target)
  }

  return supabaseResponse
}

/**
 * Fallback: obtener rol de la tabla profiles solo si user_roles no tiene dato.
 */
async function getProfileState(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<{ role?: string; status?: string }> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role,status')
      .eq('id', userId)
      .maybeSingle()

    if (typeof profile === 'object' && profile && 'role' in profile) {
      const typedProfile = profile as { role?: string | null; status?: string | null }
      return {
        role: typedProfile.role ?? undefined,
        status: typedProfile.status ?? undefined,
      }
    }
  } catch {
    // silenciar
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (typeof profile === 'object' && profile && 'role' in profile) {
      return {
        role: (profile as { role?: string | null }).role ?? undefined,
      }
    }
  } catch {
    // silenciar
  }

  return {}
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/dashboard/:path*',
    '/admin/:path*',
    '/superadmin/:path*',
  ],
}
