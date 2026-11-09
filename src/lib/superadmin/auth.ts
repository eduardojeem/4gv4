import { redirect } from 'next/navigation'
import { createClient, getRequestBearerToken } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { buildMfaPath, hasVerifiedFactor, needsSuperAdminMfa, readTokenAal } from '@/lib/auth/mfa'

export type SuperAdminUser = {
  id: string
  email: string | null
  role: 'super_admin'
}

type SuperAdminResolution =
  | { status: 'ok'; user: SuperAdminUser }
  /** Es superadmin pero esta sesión no pasó la verificación en dos pasos. */
  | { status: 'mfa_required'; hasFactor: boolean }
  | { status: 'denied' }

async function resolveSuperAdmin(): Promise<SuperAdminResolution> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { status: 'denied' }
  }

  const admin = createAdminSupabase()

  const { data: profile } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  const status = typeof profile?.status === 'string' ? profile.status : null
  const isActiveUser = status !== 'inactive' && status !== 'suspended'

  if (!isActiveUser) {
    return { status: 'denied' }
  }

  const { data: userRole } = await admin
    .from('user_roles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  if (userRole?.role !== 'super_admin' || userRole?.is_active === false) {
    return { status: 'denied' }
  }

  // Con un factor verificado y sin código, `getUser` ya devolvió error. Acá queda
  // el superadmin que nunca activó la 2FA: también se lo frena.
  const bearer = await getRequestBearerToken()
  const token = bearer ?? (await supabase.auth.getSession()).data.session?.access_token
  if (needsSuperAdminMfa(readTokenAal(token))) {
    return { status: 'mfa_required', hasFactor: hasVerifiedFactor(user) }
  }

  return {
    status: 'ok',
    user: {
      id: user.id,
      email: user.email ?? null,
      role: 'super_admin',
    },
  }
}

/** El superadmin con sesión verificada en dos pasos, o null (las APIs responden 403). */
export async function getSuperAdminUser(): Promise<SuperAdminUser | null> {
  const result = await resolveSuperAdmin()
  return result.status === 'ok' ? result.user : null
}

export async function requireSuperAdmin() {
  const result = await resolveSuperAdmin()

  if (result.status === 'mfa_required') {
    // El proxy ya redirige con la ruta exacta; esto cubre cualquier camino que no pase por él.
    redirect(buildMfaPath('/superadmin', { setup: !result.hasFactor }))
  }

  if (result.status !== 'ok') {
    redirect('/dashboard')
  }

  return result.user
}
