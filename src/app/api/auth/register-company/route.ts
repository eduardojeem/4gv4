import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { registerCompanySchema } from '@/lib/validation/saas'
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
} from './provisioning'

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

    // Se acepta el tier o el slug publico: los enlaces que circulan usan el
    // slug, y la API no deberia depender de que el navegador ya lo tradujera.
    //
    // El slug manda y el tier es respaldo, en dos consultas y no en un `or`: los
    // dos espacios de nombres se cruzan —`pro` puede ser el slug de un plan y el
    // tier de otro— y un `or` con limit(1) deja el resultado a merced del orden
    // que devuelva la base.
    const buscarPlan = (columna: 'public_slug' | 'tier') => admin
      .from('subscription_plans')
      .select('tier, name, is_active, trial_days')
      .eq('is_active', true)
      .eq(columna, selectedPlanTier)
      .maybeSingle()

    const porSlug = await buscarPlan('public_slug')
    const { data: subscriptionPlan, error: planError } = porSlug.data || porSlug.error
      ? porSlug
      : await buscarPlan('tier')

    if (planError) {
      logger.error('Failed to validate selected plan', { error: planError.message, plan: selectedPlanTier })
      return NextResponse.json(
        { success: false, error: 'No se pudo validar el plan seleccionado.' },
        { status: 500 }
      )
    }

    if (!subscriptionPlan) {
      // Antes esto solo podia pasar con un `?plan=` armado a mano. Ahora tambien
      // cubre el plan que se desactivo despues de que alguien guardara el enlace:
      // el mensaje tiene que decir que hacer, no solo que fallo.
      return NextResponse.json(
        {
          success: false,
          error: 'Ese plan ya no está disponible. Elegí uno de los planes vigentes.',
          fieldErrors: [{ field: 'plan', message: 'Ese plan ya no está disponible.' }],
        },
        { status: 400 }
      )
    }

    // El tier real sale de la fila, no de lo que llego: si vino por slug publico,
    // lo que se guarda tiene que ser el tier.
    const resolvedPlanTier = String(subscriptionPlan.tier).toUpperCase()

    const { data: existingOrganization, error: slugError } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', companySlug)
      .maybeSingle()

    if (slugError) {
      logger.error('Failed to check organization slug', { error: slugError.message })
      return NextResponse.json(
        { success: false, error: 'No se pudo validar el nombre de la empresa.' },
        { status: 500 }
      )
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

    const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
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

      return NextResponse.json(
        { success: false, error: authError?.message || 'No se pudo crear el usuario.' },
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
          error: 'Ya existe una cuenta con este correo. Inicia sesion para crear una empresa.',
        },
        { status: 409 }
      )
    }

    const userId = authData.user.id

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert({
        name: input.companyName,
        slug: companySlug,
        plan: resolvedPlanTier,
        owner_id: userId,
      })
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

    const provisioningResults = await Promise.allSettled([
      admin.from('organization_members').upsert(
        {
          organization_id: organization.id,
          user_id: userId,
          role: 'owner',
          status: 'active',
        },
        { onConflict: 'organization_id,user_id' }
      ),
      admin.from('organization_settings').upsert(
        {
          organization_id: organization.id,
          display_name: input.companyName,
          currency: 'PYG',
          timezone: 'America/Asuncion',
          branding: {},
          modules: {
            onboarding: {
              status: 'pending',
              selected_plan: resolvedPlanTier,
              started_at: new Date().toISOString(),
            },
          },
        },
        { onConflict: 'organization_id' }
      ),
      admin.from('subscriptions').upsert(
        {
          organization_id: organization.id,
          plan: resolvedPlanTier,
          status: 'trialing',
          trial_ends_at: new Date(
            Date.now() + (subscriptionPlan.trial_days ?? 14) * 24 * 60 * 60 * 1000
          ).toISOString(),
          cancel_at_period_end: false,
        },
        { onConflict: 'organization_id' }
      ),
      admin.from('profiles').upsert({
        id: userId,
        email: input.email,
        full_name: input.fullName,
        role: 'admin',
      }),
      admin.from('user_roles').upsert(
        {
          user_id: userId,
          role: 'admin',
          is_active: true,
        },
        { onConflict: 'user_id' }
      ),
      // Use upsert instead of insert so a retry after a partial failure (where
      // the branch row already exists) doesn't treat the duplicate as a fatal
      // provisioning error.
      admin.from('branches').upsert(
        {
          organization_id: organization.id,
          code: 'principal',
          name: 'Sucursal principal',
          slug: 'principal',
          is_active: true,
          is_default: true,
          metadata: {},
        },
        { onConflict: 'organization_id,code', ignoreDuplicates: true }
      ),
    ])

    const provisioningFailures = getProvisioningFailures([
      { name: 'organization_members', result: provisioningResults[0] },
      { name: 'organization_settings', result: provisioningResults[1] },
      { name: 'subscriptions', result: provisioningResults[2] },
      { name: 'profiles', result: provisioningResults[3] },
      { name: 'user_roles', result: provisioningResults[4] },
      { name: 'branches', result: provisioningResults[5] },
    ])

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

    logger.info('Company registered', {
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
        plan: subscriptionPlan.name || resolvedPlanTier,
        loginUrl: `${appUrl}/login`,
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
          planName: subscriptionPlan.name,
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
