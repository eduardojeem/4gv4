import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { validatePassword } from '@/lib/auth/password-validation'
import { logger } from '@/lib/logger'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { linkPublicCustomerAccount } from '@/lib/customers/link-public-customer-account'
import { captchaTokenSchema } from '@/lib/auth/captcha'

const customerRegisterSchema = z.object({
  // Optional: when omitted the account is a marketplace-wide customer identity
  // (auth + profile + role only). When present, the customer is also linked to
  // that specific store.
  organizationSlug: z.string().trim().min(1).max(64).optional().nullable(),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(50).optional().nullable(),
  password: z.string().min(1).refine((value) => !validatePassword(value), {
    message: 'La contrasena no cumple los requisitos de seguridad',
  }),
  captchaToken: captchaTokenSchema,
})

function getSupabaseErrorMessage(result: unknown) {
  if (
    result &&
    typeof result === 'object' &&
    'error' in result &&
    result.error &&
    typeof result.error === 'object' &&
    'message' in result.error
  ) {
    return String(result.error.message)
  }

  return null
}

export async function POST(request: Request) {
  try {
    // Rate limit por IP para frenar abuso del registro público de clientes.
    const clientIp = getClientIp(request)
    const allowed = await rateLimiter.check(`customer-register:${clientIp}`, 5, 10 * 60 * 1000)
    if (!allowed) {
      const retryAfter = rateLimiter.getResetTime(`customer-register:${clientIp}`)
      return NextResponse.json(
        { success: false, error: 'Demasiados intentos de registro. Intenta nuevamente en unos minutos.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const validation = customerRegisterSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Error de validación', details: validation.error.issues },
        { status: 400 }
      )
    }

    const input = validation.data
    const admin = createAdminSupabase()

    let organization: { id: string; name: string; slug: string } | null = null
    if (input.organizationSlug) {
      const { data, error: organizationError } = await admin
        .from('organizations')
        .select('id, name, slug')
        .eq('slug', input.organizationSlug)
        .maybeSingle()

      if (organizationError || !data) {
        return NextResponse.json(
          { success: false, error: 'Empresa no encontrada.' },
          { status: 404 }
        )
      }
      organization = data
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: 'Supabase no esta configurado.' },
        { status: 500 }
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
        data: {
          full_name: input.fullName,
          registration_type: organization ? 'tenant_customer' : 'marketplace_customer',
          ...(organization
            ? { organization_slug: organization.slug, organization_id: organization.id }
            : {}),
        },
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, error: authError?.message || 'No se pudo crear el usuario.' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // Si el email ya pertenecía a un usuario con rol de staff (Supabase puede devolver
    // el id existente por anti-enumeración), NO degradamos su rol a 'cliente'.
    const STAFF_ROLES = ['admin', 'super_admin', 'owner', 'vendedor', 'tecnico', 'inventory_manager']
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    const existingRole = typeof existingProfile?.role === 'string' ? existingProfile.role : null
    const roleToSet = existingRole && STAFF_ROLES.includes(existingRole) ? existingRole : 'cliente'

    // Global identity (always): profile + role as a customer. This is what makes
    // a single account usable across the marketplace and every store.
    const globalSetup = await Promise.all([
      admin.from('profiles').upsert({
        id: userId,
        email: input.email,
        full_name: input.fullName,
        role: roleToSet,
        status: 'active',
      }),
      admin.from('user_roles').upsert(
        {
          user_id: userId,
          role: roleToSet,
          is_active: true,
        },
        { onConflict: 'user_id' }
      ),
    ])

    const globalSetupError = globalSetup.map(getSupabaseErrorMessage).find(Boolean)
    if (globalSetupError) {
      logger.error('Failed to finish public customer registration (global identity)', {
        error: globalSetupError,
        userId,
      })
      return NextResponse.json(
        {
          success: false,
          code: 'customer_register_link_failed',
          error: 'La cuenta fue creada, pero no se pudo completar tu perfil. Contacta soporte.',
        },
        { status: 500 }
      )
    }

    // Per-store link (only when registering from within a specific store).
    if (organization) {
      try {
        await linkPublicCustomerAccount(admin, {
          organizationId: organization.id,
          profileId: userId,
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
        })
      } catch (linkError) {
        logger.error('Failed to finish public customer registration', {
          error: linkError,
          userId,
          organizationId: organization.id,
        })
        return NextResponse.json(
          {
            success: false,
            code: 'customer_register_link_failed',
            error: 'La cuenta fue creada, pero no se pudo vincular como cliente de esta empresa. Contacta soporte.',
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          organization,
          requiresEmailConfirmation: !authData.session,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Public customer register API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error inesperado al crear el cliente.' },
      { status: 500 }
    )
  }
}
