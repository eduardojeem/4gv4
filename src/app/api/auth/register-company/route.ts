import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { registerCompanySchema } from '@/lib/validation/saas'
import { logger } from '@/lib/logger'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import {
  buildCompanyRegistrationRedirectUrl,
  getProvisioningFailures,
  isExistingConfirmedAuthUser,
} from './provisioning'

type RegisterAdminClient = ReturnType<typeof createAdminSupabase>
type RegisteredAuthUser = {
  id: string
  identities?: unknown[] | null
}

async function cleanupNewAuthUser(
  admin: RegisterAdminClient,
  user: RegisteredAuthUser,
  context: Record<string, unknown>
) {
  if (!Array.isArray(user.identities) || user.identities.length === 0) {
    return
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    logger.error('Failed to cleanup newly created auth user after registration failure', {
      ...context,
      userId: user.id,
      error: error.message,
    })
  }
}

export async function POST(request: Request) {
  // Rate limit: 3 registrations per IP per 10 minutes
  const clientIp = getClientIp(request)
  const allowed = rateLimiter.check(`register:${clientIp}`, 3, 10 * 60 * 1000)
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
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      )
    }

    const input = validation.data
    const selectedPlan = input.selectedPlan
    const selectedPlanTier = selectedPlan.toLowerCase()

    if (!input.companySlug) {
      return NextResponse.json(
        { success: false, error: 'El slug de la empresa no es valido.' },
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

    const { data: subscriptionPlan, error: planError } = await admin
      .from('subscription_plans')
      .select('tier, name, is_active, trial_days')
      .eq('tier', selectedPlanTier)
      .eq('is_active', true)
      .maybeSingle()

    if (planError) {
      logger.error('Failed to validate selected plan', { error: planError.message, plan: selectedPlanTier })
      return NextResponse.json(
        { success: false, error: 'No se pudo validar el plan seleccionado.' },
        { status: 500 }
      )
    }

    if (!subscriptionPlan) {
      return NextResponse.json(
        { success: false, error: 'El plan seleccionado no esta disponible.' },
        { status: 400 }
      )
    }

    const { data: existingOrganization, error: slugError } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', input.companySlug)
      .maybeSingle()

    if (slugError) {
      logger.error('Failed to check organization slug', { error: slugError.message })
      return NextResponse.json(
        { success: false, error: 'No se pudo validar el nombre de la empresa.' },
        { status: 500 }
      )
    }

    if (existingOrganization) {
      return NextResponse.json(
        { success: false, error: 'Ese subdominio ya esta en uso. Elige otro.' },
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
        emailRedirectTo: buildCompanyRegistrationRedirectUrl(request),
        data: {
          full_name: input.fullName,
          company_name: input.companyName,
          company_slug: input.companySlug,
          selected_plan: selectedPlan,
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
        slug: input.companySlug,
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
        slug: input.companySlug,
        plan: selectedPlan,
        owner_id: userId,
      })
      .select('id, name, slug, plan')
      .single()

    if (organizationError || !organization) {
      logger.error('Failed to create organization after signup', {
        error: organizationError?.message,
        userId,
        slug: input.companySlug,
      })

      await cleanupNewAuthUser(admin, authData.user, {
        slug: input.companySlug,
        stage: 'organization_creation',
      })

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
              selected_plan: selectedPlan,
              started_at: new Date().toISOString(),
            },
          },
        },
        { onConflict: 'organization_id' }
      ),
      admin.from('subscriptions').upsert(
        {
          organization_id: organization.id,
          plan: selectedPlan,
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
        status: 'active',
      }),
      admin.from('user_roles').upsert(
        {
          user_id: userId,
          role: 'admin',
          is_active: true,
        },
        { onConflict: 'user_id' }
      ),
      admin.from('branches').insert({
        organization_id: organization.id,
        code: 'principal',
        name: 'Sucursal principal',
        slug: 'principal',
        is_active: true,
        is_default: true,
      }),
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

      const cleanupResult = await admin
        .from('organizations')
        .delete()
        .eq('id', organization.id)

      if (cleanupResult.error) {
        logger.error('Failed to cleanup partially provisioned organization', {
          organizationId: organization.id,
          error: cleanupResult.error.message,
        })
      }

      await cleanupNewAuthUser(admin, authData.user, {
        organizationId: organization.id,
        slug: organization.slug,
        stage: 'company_provisioning',
      })

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
      plan: selectedPlan,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          organization,
          selectedPlan,
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
