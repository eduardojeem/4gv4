import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { validatePassword } from '@/lib/auth/password-validation'
import { logger } from '@/lib/logger'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { linkPublicCustomerAccount } from '@/lib/customers/link-public-customer-account'
import { captchaTokenSchema } from '@/lib/auth/captcha'
import { describeAuthError, EMAIL_YA_REGISTRADO, signUpFoundExistingAccount } from '@/lib/auth/auth-error-messages'

const customerRegisterSchema = z.object({
  // Optional: when omitted the account is a marketplace-wide customer identity
  // (auth + profile + role only). When present, the customer is also linked to
  // that specific store.
  organizationSlug: z.string().trim().min(1).max(64).optional().nullable(),
  fullName: z
    .string({ error: 'Escribí tu nombre y apellido.' })
    .trim()
    .min(2, 'Escribí tu nombre y apellido (al menos 2 letras).')
    .max(160, 'El nombre es demasiado largo: hasta 160 caracteres.'),
  email: z
    .string({ error: 'Escribí tu correo electrónico.' })
    .trim()
    .max(254, 'El correo es demasiado largo.')
    .email('Revisá el correo: tiene que ser como nombre@correo.com.'),
  phone: z
    .string()
    .trim()
    .max(50, 'El teléfono es demasiado largo.')
    .optional()
    .nullable(),
  password: z
    .string({ error: 'Elegí una contraseña.' })
    .min(1, 'Elegí una contraseña.')
    // El mensaje sale de la misma función que usa el formulario, así la
    // persona lee exactamente lo que le falta y no un texto genérico.
    .superRefine((value, ctx) => {
      const problema = validatePassword(value)
      if (problema) ctx.addIssue({ code: 'custom', message: problema })
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
        { success: false, error: 'Hiciste varios intentos de registro seguidos. Esperá unos minutos y volvé a probar.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const validation = customerRegisterSchema.safeParse(await request.json())

    if (!validation.success) {
      // El primer problema, en castellano y con el campo que lo causó: el
      // formulario lo muestra al lado del dato equivocado.
      const primero = validation.error.issues[0]
      return NextResponse.json(
        {
          success: false,
          error: primero?.message || 'Revisá los datos del formulario.',
          field: primero?.path?.[0] ?? null,
          details: validation.error.issues,
        },
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
          { success: false, error: 'No encontramos esta tienda. Volvé a entrar desde su página.' },
          { status: 404 }
        )
      }
      organization = data
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.error('Customer register sin credenciales de Supabase')
      return NextResponse.json(
        { success: false, error: 'La tienda no puede crear cuentas en este momento. Probá más tarde.' },
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
      // El texto original de Supabase viene en inglés: queda en el log.
      logger.warn('Customer register rechazado por Supabase', { error: authError?.message })
      return NextResponse.json(
        { success: false, error: describeAuthError(authError?.message, 'register') },
        { status: 400 }
      )
    }

    // Correo ya registrado. Supabase no lo dice para que nadie pueda averiguar
    // quién tiene cuenta, pero devuelve el usuario sin identidades. Si no se
    // mira, se responde «cuenta creada» por un mail que nunca llega, y el
    // upsert de abajo pisaría el nombre y el estado de una cuenta ajena.
    if (signUpFoundExistingAccount(authData.user)) {
      return NextResponse.json(
        { success: false, code: 'email_already_registered', error: EMAIL_YA_REGISTRADO },
        { status: 409 }
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
          error: 'Creamos tu cuenta, pero no pudimos terminar tu perfil. Escribinos y lo resolvemos.',
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
            error: 'Creamos tu cuenta, pero no pudimos vincularla con esta tienda. Iniciá sesión y desde ahí la vinculás.',
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
      { success: false, error: 'Tuvimos un problema al crear tu cuenta. Intentá de nuevo en un momento.' },
      { status: 500 }
    )
  }
}
