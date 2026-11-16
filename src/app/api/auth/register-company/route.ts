import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { registerCompanySchema } from '@/lib/validation/saas'
import { describeAuthError } from '@/lib/auth/auth-error-messages'
import { logger } from '@/lib/logger'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { normalizeTenantSlug, validateTenantSlug } from '@/lib/saas/reserved-slugs'
import { sendEmail } from '@/lib/email/resend'
import { renderWelcomeEmail } from '@/lib/email/templates'
import {
  buildCompanyRegistrationRedirectUrl,
  cleanupPartialProvisioning,
  getProvisioningFailures,
  isExistingConfirmedAuthUser,
  isOwnPendingRegistration,
  PENDING_REGISTRATION_CODE,
  PENDING_REGISTRATION_MESSAGE,
} from './provisioning'
import { provisionStarterKit } from '@/lib/organization/starter-kit'
import { findSignupPlan, organizationInsertRow, provisionCompanyRows, PROVISIONING_STEPS } from '@/lib/organization/provision-company'
import { loadPlatformPolicies, type PlatformPolicyClient } from '@/lib/platform/policies'

type RegisterAdminClient = ReturnType<typeof createAdminSupabase>
type RegisteredAuthUser = {
  id: string
  identities?: unknown[] | null
}

export async function POST(request: Request) {
  // Rate limit: 3 registrations per IP per 10 minutes.
  // NOTE: This is a per-instance in-memory limit. On multi-instance serverless
  // deployments (Vercel) each lambda has its own Map, so the effective limit is
  // higher than 3. For a strict global cap, migrate to a shared store
  // (e.g. Upstash Redis). Despite this, the limit still catches single-IP
  // burst abuse hitting the same warm instance.
  const clientIp = getClientIp(request)
  const allowed = await rateLimiter.check(`register:${clientIp}`, 3, 10 * 60 * 1000)
  if (!allowed) {
    const retryAfter = rateLimiter.getResetTime(`register:${clientIp}`)
    return NextResponse.json(
      { success: false, error: 'Demasiados intentos de registro. Intenta nuevamente en unos minutos.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    )
  }

  try {
    const body = await request.json()
    const validation = registerCompanySchema.safeParse(body)

    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
      return NextResponse.json(
        {
          success: false,
          error: fieldErrors[0]?.message ?? 'Datos inválidos. Revisá el formulario.',
          fieldErrors,
        },
        { status: 400 }
      )
    }

    const input = validation.data

    // Políticas de la plataforma (Superadmin → Configuración).
    const policies = await loadPlatformPolicies(createAdminSupabase() as unknown as PlatformPolicyClient)
    if (!policies.allowRegistration) {
      return NextResponse.json(
        { success: false, code: 'REGISTRATION_CLOSED', error: 'El registro de empresas está cerrado por el momento. Escribinos para crear tu cuenta.' },
        { status: 403 }
      )
    }
    if (input.password.length < policies.passwordMinLength) {
      const message = `La contraseña tiene que tener al menos ${policies.passwordMinLength} caracteres.`
      return NextResponse.json(
        { success: false, error: message, fieldErrors: [{ field: 'password', message }] },
        { status: 400 }
      )
    }

    const selectedPlan = input.selectedPlan
    const selectedPlanTier = selectedPlan.toLowerCase()

    // El slug se normaliza y se valida aca, no solo en el navegador. El esquema
    // aceptaba cualquier texto de hasta 64 caracteres y la unica limpieza vivia
    // en el formulario, asi que una llamada directa a la API podia crear una
    // tienda con slug `Admin`, `mi tienda` o uno que tapa una ruta del sistema.
    const companySlug = normalizeTenantSlug(input.companySlug ?? input.companyName)
    const slugCheck = validateTenantSlug(companySlug)

    if (slugCheck.ok === false) {
      return NextResponse.json(
        {
          success: false,
          error: slugCheck.message,
          fieldErrors: [{ field: 'companySlug', message: slugCheck.message }],
        },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase no esta configurado.' },
        { status: 500 }
      )
    }

    const admin = createAdminSupabase()

    const { plan: signupPlan, error: planError } = await findSignupPlan(admin, selectedPlanTier)

    if (planError) {
      logger.error('Failed to validate selected plan', { error: planError, plan: selectedPlanTier })
      return NextResponse.json(
        { success: false, error: 'No se pudo validar el plan seleccionado.' },
        { status: 500 }
      )
    }

    if (!signupPlan) {
      // Tambien cubre el plan que se desactivo despues de que alguien guardara
      // el enlace: el mensaje tiene que decir que hacer, no solo que fallo.
      return NextResponse.json(
        {
          success: false,
          error: 'Ese plan ya no está disponible. Elegí uno de los planes vigentes.',
          fieldErrors: [{ field: 'plan', message: 'Ese plan ya no está disponible.' }],
        },
        { status: 400 }
      )
    }

    const resolvedPlanTier = signupPlan.tier
    const trialDays = signupPlan.trialDays

    const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    const pendingRegistration = () => NextResponse.json(
      { success: false, error: PENDING_REGISTRATION_MESSAGE, code: PENDING_REGISTRATION_CODE },
      { status: 409 }
    )

    const { data: existingOrganization, error: slugError } = await admin
      .from('organizations')
      .select('id, owner_id')
      .eq('slug', companySlug)
      .maybeSingle()

    if (slugError) {
      logger.error('Failed to check organization slug', { error: slugError.message })
      return NextResponse.json(
        { success: false, error: 'No se pudo validar el nombre de la empresa.' },
        { status: 500 }
      )
    }

    // La direccion es de esta misma persona, que se registro y no confirmo:
    // antes le decia «ya esta en uso» y nunca le volvia a llegar el correo.
    if (existingOrganization && await isOwnPendingRegistration(admin, (existingOrganization as { owner_id?: string | null }).owner_id, input.email)) {
      const { error: resendError } = await authClient.auth.resend({
        type: 'signup',
        email: input.email,
        options: { captchaToken: input.captchaToken, emailRedirectTo: buildCompanyRegistrationRedirectUrl(request) },
      })
      if (resendError) logger.warn('Could not resend signup confirmation', { error: resendError.message, slug: companySlug })
      return pendingRegistration()
    }

    if (existingOrganization) {
      // Va tambien como error de campo: como banner suelto el usuario tenia que
      // adivinar cual de los campos revisar, y el captcha ya se reinicio.
      const mensaje = 'Esa dirección ya está en uso. Elegí otra.'
      return NextResponse.json(
        {
          success: false,
          error: mensaje,
          fieldErrors: [{ field: 'companySlug', message: mensaje }],
        },
        { status: 409 }
      )
    }

    const { data: authData, error: authError } = await authClient.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        captchaToken: input.captchaToken,
        emailRedirectTo: buildCompanyRegistrationRedirectUrl(request),
        data: {
          full_name: input.fullName,
          company_name: input.companyName,
          company_slug: companySlug,
          selected_plan: resolvedPlanTier,
          registration_type: 'company_owner',
        },
      },
    })

    if (authError || !authData.user) {
      logger.warn('Company owner signup failed', {
        error: authError?.message,
        email: input.email,
      })

      const message = describeAuthError(authError?.message, 'company-register')
      const passwordRejected = authError?.code === 'weak_password' || /password.*(weak|short)|password should be|easy to guess/i.test(authError?.message ?? '')
      return NextResponse.json(
        { success: false, error: message, ...(passwordRejected ? { fieldErrors: [{ field: 'password', message }] } : {}) },
        { status: 400 }
      )
    }

    if (isExistingConfirmedAuthUser(authData.user)) {
      logger.warn('Company owner signup attempted with an existing confirmed email', {
        email: input.email,
        slug: companySlug,
      })

      return NextResponse.json(
        {
          success: false,
          code: 'ACCOUNT_EXISTS',
          // Típico: se registró como cliente y ahora quiere vender. Con su cuenta
          // iniciada crea el comercio en /register/comercio, sin otra cuenta.
          error: 'Ya tenés una cuenta con este correo. Ingresá con ella y creá tu comercio desde ahí.',
        },
        { status: 409 }
      )
    }

    const userId = authData.user.id

    // Mismo email sin confirmar y con otro nombre de comercio: antes se creaba un
    // segundo comercio para la misma persona. signUp ya le reenvio la confirmacion.
    const { data: ownedOrganization, error: ownedError } = await admin
      .from('organizations')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle()
    if (ownedError) {
      logger.error('Failed to check existing organizations for signup', { error: ownedError.message, userId })
      return NextResponse.json({ success: false, error: 'No se pudo validar el registro. Intentá de nuevo.' }, { status: 500 })
    }
    if (ownedOrganization) return pendingRegistration()

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert(organizationInsertRow({ companyName: input.companyName, companySlug, plan: signupPlan, userId, businessVertical: input.businessVertical }))
      .select('id, name, slug, plan')
      .single()

    if (organizationError || !organization) {
      logger.error('Failed to create organization after signup', {
        error: organizationError?.message,
        userId,
        slug: companySlug,
      })

      // Only the auth user needs cleanup at this stage — org doesn't exist yet.
      if (Array.isArray(authData.user.identities) && authData.user.identities.length > 0) {
        await admin.auth.admin.deleteUser(userId)
      }

      return NextResponse.json(
        {
          success: false,
          error: 'No se pudo crear la empresa. Intenta nuevamente o contacta soporte.',
        },
        { status: 500 }
      )
    }

    const provisioningResults = await provisionCompanyRows(admin, {
      organizationId: organization.id,
      userId,
      email: input.email,
      fullName: input.fullName,
      companyName: input.companyName,
      plan: signupPlan,
      businessVertical: input.businessVertical,
    })

    const provisioningFailures = getProvisioningFailures(
      PROVISIONING_STEPS.map((name, index) => ({ name, result: provisioningResults[index] }))
    )

    if (provisioningFailures.length > 0) {
      logger.error('Company provisioning failed after organization creation', {
        userId,
        organizationId: organization.id,
        slug: organization.slug,
        failures: provisioningFailures,
      })

      // Full rollback: removes all partially-created rows for this org + user.
      await cleanupPartialProvisioning(
        admin as RegisterAdminClient,
        authData.user as RegisteredAuthUser,
        organization.id,
        { userId, organizationId: organization.id, slug: organization.slug, stage: 'company_provisioning' },
        logger,
      )

      return NextResponse.json(
        {
          success: false,
          error: 'No se pudo completar la configuracion de la empresa. Intenta nuevamente o contacta soporte.',
        },
        { status: 500 }
      )
    }

    // Caja principal y categorías del rubro: lo que hace falta para vender el
    // primer día. Si algo no se crea, el alta sigue: se puede crear a mano.
    const starterKit = await provisionStarterKit(
      admin,
      { organizationId: organization.id, vertical: input.businessVertical ?? null, userId },
      (message, meta) => logger.warn(message, meta),
    )

    logger.info('Company registered', {
      starterKit,
      userId,
      organizationId: organization.id,
      slug: organization.slug,
      plan: resolvedPlanTier,
    })

    // Send welcome email (non-blocking — don't fail registration if email fails)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
    sendEmail({
      to: input.email,
      subject: `Bienvenido a la plataforma — ${input.companyName}`,
      html: renderWelcomeEmail({
        ownerName: input.fullName,
        companyName: input.companyName,
        plan: signupPlan.name || resolvedPlanTier,
        loginUrl: `${appUrl}/login`,
        trialDays,
      }),
      log: { organizationId: organization.id, customerName: input.fullName },
    }).catch((err) => {
      logger.error('Failed to send welcome email', { error: err, email: input.email })
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          organization,
          selectedPlan: resolvedPlanTier,
          planName: signupPlan.name,
          requiresEmailConfirmation: !authData.session,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Register company API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error inesperado al crear la empresa.' },
      { status: 500 }
    )
  }
}
