import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getBrowserRequestOrigin } from '@/lib/http/app-origin'
import { buildMfaPath, MFA_ENROLLMENT_REQUIRED_CODE } from '@/lib/auth/mfa'

/** Browser mutations must be same-origin JSON; native bearer clients remain supported. */
export function settlementMutationProblem(request: Request) {
  const origin = request.headers.get('origin')
  if ((origin && origin !== getBrowserRequestOrigin(request)) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'El origen de la solicitud no está autorizado.' }, { status: 403 })
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'Enviá el pago en formato JSON.' }, { status: 415 })
  }
  return null
}

/** A policy lookup failure must never turn off required MFA for financial operations. */
export async function settlementSessionProblem(organizationId: string, aal?: string | null) {
  if (aal === 'aal2') return null
  try {
    const admin = createAdminSupabase()
    const [platform, organization] = await Promise.all([
      admin.from('system_settings').select('require_two_factor').eq('id', 'system').maybeSingle(),
      admin.from('organization_settings').select('require_admin_mfa').eq('organization_id', organizationId).maybeSingle(),
    ])
    if (platform.error || organization.error) throw new Error('MFA_POLICY_UNAVAILABLE')
    if (platform.data?.require_two_factor === true || organization.data?.require_admin_mfa === true) {
      return NextResponse.json({ error: 'Verificá tu sesión en dos pasos antes de gestionar liquidaciones.', code: MFA_ENROLLMENT_REQUIRED_CODE, mfaPath: buildMfaPath('/dashboard/agenda', { setup: true }) }, { status: 403 })
    }
    return null
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar la seguridad de la sesión. Reintentá antes de pagar.', code: 'MFA_POLICY_UNAVAILABLE' }, { status: 503 })
  }
}
