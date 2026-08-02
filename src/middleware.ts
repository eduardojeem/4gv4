import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { normalizeRole } from '@/lib/auth/role-utils'
import {
  canRoleAccessSection,
  mapOrganizationRoleToDashboardRole,
} from '@/lib/auth/section-access'
import type { UserRole } from '@/lib/auth/roles-permissions'
import {
  getTenantSlugFromPath,
  getTenantSlugFromRequest,
  isTenantPublicSection,
  normalizeDefaultPublicOrgSlug,
} from '@/lib/saas/tenant'
import { ACTIVE_ORGANIZATION_COOKIE } from '@/lib/saas/active-organization'

const PROXY_AUTH_TIMEOUT_MS = 4000
const PROXY_PROFILE_TIMEOUT_MS = 3000
const DEFAULT_PUBLIC_ORG_SLUG = normalizeDefaultPublicOrgSlug(process.env.DEFAULT_PUBLIC_ORG_SLUG)
const DEFAULT_PUBLIC_HOME = DEFAULT_PUBLIC_ORG_SLUG
  ? `/${DEFAULT_PUBLIC_ORG_SLUG}/inicio`
  : '/marketplace'
const LEGACY_PUBLIC_PATHS = [
  '/inicio',
  '/productos',
  '/ofertas',
  '/servicios',
  '/mis-reparaciones',
  '/track',
  '/carrito',
]

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
  if (DEFAULT_PUBLIC_ORG_SLUG) {
    url.pathname = `/${DEFAULT_PUBLIC_ORG_SLUG}${pathname}`
  } else {
    url.pathname = pathname.startsWith('/productos')
      ? pathname.replace(/^\/productos/, '/marketplace/productos')
      : '/marketplace'
  }

  return NextResponse.redirect(url, 308)
}

async function redirectOrganizationSlugAlias(request: NextRequest) {
  const [maybeSlug, section] = request.nextUrl.pathname.split('/').filter(Boolean)
  if (!maybeSlug || !isTenantPublicSection(section)) {
    return null
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your_supabase_project_url') {
    return null
  }

  try {
    const aliasUrl = new URL('/rest/v1/organization_slug_aliases', supabaseUrl)
    aliasUrl.searchParams.set('old_slug', `eq.${maybeSlug}`)
    aliasUrl.searchParams.set('select', 'new_slug')
    aliasUrl.searchParams.set('limit', '1')

    const response = await withTimeout(
      fetch(aliasUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }),
      1000,
      null
    )

    if (!response?.ok) {
      return null
    }

    const aliases = await response.json().catch(() => []) as Array<{ new_slug?: string }>
    const newSlug = aliases[0]?.new_slug
    if (!newSlug || newSlug === maybeSlug) {
      return null
    }

    const url = request.nextUrl.clone()
    const parts = url.pathname.split('/').filter(Boolean)
    parts[0] = newSlug
    url.pathname = `/${parts.join('/')}`
    return NextResponse.redirect(url, 308)
  } catch {
    return null
  }
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

type SupabaseSingleResponse<T> = {
  data: T | null
  error: { message?: string } | null
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

function sanitizeLocalRedirect(value: string | null, fallback: string): string {
  if (!value) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback

  const firstSlash = value.indexOf('/', 1)
  const segment = firstSlash > 0 ? value.slice(0, firstSlash) : value
  if (segment.includes(':')) return fallback

  return value
}

function redirectToLogin(request: NextRequest, source: NextResponse): NextResponse {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  loginUrl.searchParams.set('redirect', `${request.nextUrl.pathname}${request.nextUrl.search}`)

  return applyResponseCookies(NextResponse.redirect(loginUrl), source)
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

export async function middleware(request: NextRequest) {
  const legacyPublicRedirect = redirectLegacyPublicPath(request)
  if (legacyPublicRedirect) {
    return legacyPublicRedirect
  }

  const slugAliasRedirect = await redirectOrganizationSlugAlias(request)
  if (slugAliasRedirect) {
    return slugAliasRedirect
  }

  const requestHeaders = new Headers(request.headers)
  const pathname = request.nextUrl.pathname

  // Los headers de tenant los setea SOLO este middleware. Se eliminan los
  // entrantes para que un cliente no pueda inyectarlos y suplantar contexto
  // de organización en código server-side que confíe en ellos.
  requestHeaders.delete('x-tenant-slug')
  requestHeaders.delete('x-organization-id')

  // Only inject tenant slug for public-facing routes, never for dashboard/admin/API
  const isAppRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/admin') ||
    pathname.startsWith('/superadmin') || pathname.startsWith('/api/')

  const tenantSlug = isAppRoute
    ? null
    : (getTenantSlugFromRequest(request) ?? getTenantSlugFromPath(pathname))

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
      const roleWithStatusQuery = Promise.resolve(
        supabase
          .from('user_roles')
          .select('role,is_active')
          .eq('user_id', user.id)
          .maybeSingle()
      ) as unknown as Promise<SupabaseSingleResponse<{ role: string | null; is_active: boolean | null }>>

      const { data: roleWithStatus, error: roleWithStatusError } = await withTimeout(
        roleWithStatusQuery,
        PROXY_PROFILE_TIMEOUT_MS,
        { data: null, error: null }
      )

      let rawRole = roleWithStatus?.role ?? undefined

      if (!roleWithStatusError) {
        roleIsActive = roleWithStatus?.is_active !== false
      } else if (roleWithStatusError.message?.includes('is_active')) {
        const roleOnlyQuery = Promise.resolve(
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle()
        ) as unknown as Promise<SupabaseSingleResponse<{ role: string | null }>>

        const { data: roleOnly } = await withTimeout(
          roleOnlyQuery,
          PROXY_PROFILE_TIMEOUT_MS,
          { data: null, error: null }
        )

        rawRole = roleOnly?.role ?? undefined
      }

      const profile = await withTimeout(
        getProfileState(supabase, user.id),
        PROXY_PROFILE_TIMEOUT_MS,
        {}
      )
      profileIsActive = !profile.status || profile.status === 'active'

      // Superadmin is canonical in user_roles. A stale profile must never
      // restore platform access after revocation.
      if (!rawRole && profile.role !== 'super_admin') {
        rawRole = profile.role
      }

      normalizedRole = normalizeRole(rawRole)
    } catch {
      normalizedRole = undefined
      roleIsActive = true
      profileIsActive = true
    }
  }

  let effectiveRole = (normalizedRole ?? 'cliente') as UserRole
  const isActiveUser = roleIsActive && profileIsActive
  let isClientOrViewer = !isActiveUser || effectiveRole === 'cliente'

  // If profile says 'cliente' but user owns/manages an organization, grant dashboard access
  if (isClientOrViewer && user && isActiveUser) {
    try {
      // Use direct DB query bypassing RLS — middleware runs before the user
      // has a "session context" that satisfies is_org_member policies.
      const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (adminUrl && serviceKey) {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const adminSupabase = createAdminClient(adminUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const activeOrganizationId = request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value
        let membershipQuery = adminSupabase
          .from('organization_members')
          .select('role,organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('role', ['owner', 'admin', 'manager', 'cashier', 'technician', 'seller'])

        if (activeOrganizationId) {
          membershipQuery = membershipQuery.eq('organization_id', activeOrganizationId)
        }

        const { data: orgRows } = await withTimeout(
          Promise.resolve(
            membershipQuery
              .order('created_at', { ascending: true })
              .limit(1)
          ) as unknown as Promise<{ data: { role: string; organization_id: string }[] | null }>,
          PROXY_PROFILE_TIMEOUT_MS,
          { data: null }
        )
        if (orgRows && orgRows.length > 0) {
          effectiveRole = mapOrganizationRoleToDashboardRole(
            orgRows[0].role as Parameters<typeof mapOrganizationRoleToDashboardRole>[0]
          )
          isClientOrViewer = false
        }
      }
    } catch {
      // If query fails, keep original isClientOrViewer value
    }
  }

  const isAdmin = isActiveUser && (effectiveRole === 'admin' || effectiveRole === 'super_admin')
  const isSuperAdmin = isActiveUser && effectiveRole === 'super_admin'

  // Rutas protegidas (dashboard) - requieren autenticacion y rol no-cliente
  if (isProtectedRoute) {
    if (!user) {
      // No logueado → redirigir al SaaS landing
      return redirectWithCookies(request, supabaseResponse, '/saas')
    }

    if (isClientOrViewer) {
      // Cliente sin permiso al dashboard → redirigir a su tienda pública
      return redirectWithCookies(request, supabaseResponse, DEFAULT_PUBLIC_HOME)
    }

    // Restricción por sección para roles limitados (vendedor/tecnico).
    // Misma fuente de verdad que el guard client-side, aplicada server-side.
    if (!canRoleAccessSection(effectiveRole, pathname)) {
      return redirectWithCookies(request, supabaseResponse, '/dashboard')
    }
  }

  // Rutas admin - requieren autenticacion y rol admin/super_admin
  if (isAdminRoute) {
    if (!user) {
      return redirectWithCookies(request, supabaseResponse, '/saas')
    }
    if (!isAdmin) {
      // No es admin → redirigir al dashboard (tiene acceso como vendedor/técnico)
      return redirectWithCookies(request, supabaseResponse, '/dashboard')
    }
  }

  if (isSuperAdminRoute || isInternalOpsRoute) {
    if (!user) {
      return redirectWithCookies(request, supabaseResponse, '/saas')
    }
    if (!isSuperAdmin) {
      // No es super_admin → redirigir al dashboard
      return redirectWithCookies(request, supabaseResponse, '/dashboard')
    }
  }

  // Si ya autenticado y en ruta de auth, redirigir segun rol
  if (isAuthRoute && user) {
    const requestedRedirect = sanitizeLocalRedirect(request.nextUrl.searchParams.get('redirect'), '/dashboard')
    const target = isClientOrViewer ? DEFAULT_PUBLIC_HOME : requestedRedirect
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
