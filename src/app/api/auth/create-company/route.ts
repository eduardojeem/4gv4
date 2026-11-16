import { NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createOwnCompanySchema } from '@/lib/validation/saas'
import { logger } from '@/lib/logger'
import { rateLimiter } from '@/lib/rate-limiter'
import { normalizeTenantSlug, validateTenantSlug } from '@/lib/saas/reserved-slugs'
import { sendEmail } from '@/lib/email/resend'
import { renderWelcomeEmail } from '@/lib/email/templates'
import { provisionStarterKit } from '@/lib/organization/starter-kit'
import { loadPlatformPolicies, type PlatformPolicyClient } from '@/lib/platform/policies'
import { findSignupPlan, organizationInsertRow, provisionCompanyRows, PROVISIONING_STEPS } from '@/lib/organization/provision-company'
import { cleanupPartialProvisioning, getProvisioningFailures } from '../register-company/provisioning'

export const dynamic = 'force-dynamic'

const ALREADY_HAS_COMPANY_CODE = 'ALREADY_HAS_COMPANY'

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status })

/**
 * Crea el comercio de quien ya tiene cuenta: entró con Google o es cliente y
 * ahora abre su negocio. Es el mismo alta que /api/auth/register-company, pero
 * sin crear el usuario: la cuenta sale de la sesión (cookie en la web, token en
 * la app), nunca del pedido, y por eso no hace falta captcha.
 *
 * Un comercio por persona, como en el registro. Una cuenta que ya trabaja en
 * otro comercio (vendedor, técnico) no puede usarlo: el alta la haría
 * administradora y cambiaría su rol en ese comercio.
 */
export async function POST(request: Request) {
  const auth = await resolveRequestAuthUser()
  if (auth.authenticated === false) {
    if (auth.reason === 'mfa_required') return json({ success: false, code: 'MFA_REQUIRED', error: 'Ingresá el código de tu app autenticadora para continuar.' }, 403)
    if (auth.reason === 'inactive') return json({ success: false, error: 'Tu cuenta está desactivada. Escribinos para revisarla.' }, 403)
    return json({ success: false, error: 'Iniciá sesión para crear tu comercio.' }, 401)
  }
  const user = auth.user

  const limitKey = `create-company:${user.id}`
  if (!(await rateLimiter.check(limitKey, 5, 10 * 60 * 1000))) {
    return NextResponse.json(
      { success: false, error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(rateLimiter.getResetTime(limitKey)) } }
    )
  }

  try {
    const validation = createOwnCompanySchema.safeParse(await request.json().catch(() => null))
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
      return json({ success: false, error: fieldErrors[0]?.message ?? 'Datos inválidos. Revisá el formulario.', fieldErrors }, 400)
    }
    const input = validation.data
    const admin = createAdminSupabase()

    const policies = await loadPlatformPolicies(admin as unknown as PlatformPolicyClient)
    if (!policies.allowRegistration) {
      return json({ success: false, code: 'REGISTRATION_CLOSED', error: 'El registro de empresas está cerrado por el momento. Escribinos para crear tu cuenta.' }, 403)
    }

    if (user.role !== 'cliente' && user.role !== 'admin') {
      return json({ success: false, code: ALREADY_HAS_COMPANY_CODE, error: 'Tu cuenta ya trabaja en un comercio. Para abrir el tuyo, creá una cuenta aparte con otro correo.' }, 409)
    }

    const [membership, owned, profile, roleRow] = await Promise.all([
      admin.from('organization_members').select('organization_id').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle(),
      admin.from('organizations').select('id').eq('owner_id', user.id).limit(1).maybeSingle(),
      admin.from('profiles').select('full_name, email, role').eq('id', user.id).maybeSingle(),
      admin.from('user_roles').select('role, is_active').eq('user_id', user.id).maybeSingle(),
    ])
    if (membership.error || owned.error || profile.error || roleRow.error) {
      logger.error('create-company: could not read the account', { userId: user.id })
      return json({ success: false, error: 'No se pudo revisar tu cuenta. Intentá de nuevo.' }, 500)
    }
    if (membership.data || owned.data) {
      return json({ success: false, code: ALREADY_HAS_COMPANY_CODE, error: 'Tu cuenta ya tiene un comercio. Entrá al panel para administrarlo.' }, 409)
    }

    const companySlug = normalizeTenantSlug(input.companySlug ?? input.companyName)
    const slugCheck = validateTenantSlug(companySlug)
    if (slugCheck.ok === false) {
      return json({ success: false, error: slugCheck.message, fieldErrors: [{ field: 'companySlug', message: slugCheck.message }] }, 400)
    }

    const { plan, error: planError } = await findSignupPlan(admin, input.plan)
    if (planError) {
      logger.error('create-company: failed to validate plan', { error: planError, plan: input.plan })
      return json({ success: false, error: 'No se pudo validar el plan seleccionado.' }, 500)
    }
    if (!plan) {
      return json({ success: false, error: 'Ese plan ya no está disponible. Elegí uno de los planes vigentes.', fieldErrors: [{ field: 'plan', message: 'Ese plan ya no está disponible.' }] }, 400)
    }

    const { data: slugTaken, error: slugError } = await admin.from('organizations').select('id').eq('slug', companySlug).maybeSingle()
    if (slugError) return json({ success: false, error: 'No se pudo validar el nombre de la empresa.' }, 500)
    if (slugTaken) {
      const message = 'Esa dirección ya está en uso. Elegí otra.'
      return json({ success: false, error: message, fieldErrors: [{ field: 'companySlug', message }] }, 409)
    }

    const email = (profile.data?.email as string | null | undefined) || user.email || ''
    const fullName = input.fullName?.trim() || (profile.data?.full_name as string | null | undefined)?.trim() || email.split('@')[0] || input.companyName

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert(organizationInsertRow({ companyName: input.companyName, companySlug, plan, userId: user.id, businessVertical: input.businessVertical }))
      .select('id, name, slug, plan')
      .single()
    if (organizationError || !organization) {
      // Una carrera con otra persona por la misma dirección termina acá (slug único).
      logger.error('create-company: failed to create organization', { error: organizationError?.message, userId: user.id, slug: companySlug })
      return json({ success: false, error: 'No se pudo crear la empresa. Revisá la dirección e intentá nuevamente.' }, 500)
    }

    const results = await provisionCompanyRows(admin, {
      organizationId: organization.id,
      userId: user.id,
      email,
      fullName,
      companyName: input.companyName,
      plan,
      businessVertical: input.businessVertical,
    })
    const failures = getProvisioningFailures(PROVISIONING_STEPS.map((name, index) => ({ name, result: results[index] })))
    if (failures.length > 0) {
      logger.error('create-company: provisioning failed', { userId: user.id, organizationId: organization.id, failures })
      // Sin identidades nuevas: la limpieza borra el comercio pero nunca la cuenta.
      await cleanupPartialProvisioning(admin, { id: user.id, identities: [] }, organization.id, { userId: user.id, organizationId: organization.id, stage: 'create_own_company' }, logger)
      // La cuenta vuelve al rol que tenía: el alta la había hecho administradora.
      await Promise.allSettled([
        admin.from('profiles').update({ role: profile.data?.role ?? 'cliente' }).eq('id', user.id),
        roleRow.data
          ? admin.from('user_roles').update({ role: roleRow.data.role, is_active: roleRow.data.is_active }).eq('user_id', user.id)
          : admin.from('user_roles').delete().eq('user_id', user.id),
      ])
      return json({ success: false, error: 'No se pudo completar la configuración de la empresa. Intentá nuevamente o contactá a soporte.' }, 500)
    }

    const starterKit = await provisionStarterKit(
      admin,
      { organizationId: organization.id, vertical: input.businessVertical ?? null, userId: user.id },
      (message, meta) => logger.warn(message, meta),
    )
    logger.info('Company created by an existing account', { starterKit, userId: user.id, organizationId: organization.id, slug: organization.slug, plan: plan.tier })

    // El comercio ya existe: si el correo de bienvenida falla, no se informa error.
    if (email) try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
      sendEmail({
        to: email,
        subject: `Bienvenido a la plataforma — ${input.companyName}`,
        html: renderWelcomeEmail({ ownerName: fullName, companyName: input.companyName, plan: plan.name || plan.tier, loginUrl: `${appUrl}/login`, trialDays: plan.trialDays }),
        log: { organizationId: organization.id, customerName: fullName },
      }).catch((err) => logger.error('Failed to send welcome email', { error: err, email }))
    } catch (err) {
      logger.error('Failed to build welcome email', { error: err, organizationId: organization.id })
    }

    return json({ success: true, data: { organization, selectedPlan: plan.tier, planName: plan.name } }, 201)
  } catch (error) {
    logger.error('create-company API error', { error })
    return json({ success: false, error: 'Error inesperado al crear la empresa.' }, 500)
  }
}
