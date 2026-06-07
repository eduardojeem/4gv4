import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { validatePassword } from '@/lib/auth/password-validation'
import { logger } from '@/lib/logger'

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
})

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  return {
    firstName: parts[0] ?? fullName,
    lastName: parts.slice(1).join(' ') || '',
  }
}

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
    const validation = customerRegisterSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
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
    const { firstName, lastName } = splitName(input.fullName)
    const now = new Date().toISOString()

    // Global identity (always): profile + role as a customer. This is what makes
    // a single account usable across the marketplace and every store.
    const globalSetup = await Promise.all([
      admin.from('profiles').upsert({
        id: userId,
        email: input.email,
        full_name: input.fullName,
        role: 'cliente',
        status: 'active',
      }),
      admin.from('user_roles').upsert(
        {
          user_id: userId,
          role: 'cliente',
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
      let { data: existingCustomer } = await admin
        .from('customers')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('profile_id', userId)
        .maybeSingle()

      if (!existingCustomer) {
        const { data: emailCustomer } = await admin
          .from('customers')
          .select('id')
          .eq('organization_id', organization.id)
          .ilike('email', input.email)
          .limit(1)
          .maybeSingle()

        existingCustomer = emailCustomer
      }

      if (!existingCustomer && input.phone) {
        const { data: phoneCustomer } = await admin
          .from('customers')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('phone', input.phone)
          .limit(1)
          .maybeSingle()

        existingCustomer = phoneCustomer
      }

      const setupResults = await Promise.all([
        admin.from('organization_members').upsert(
          {
            organization_id: organization.id,
            user_id: userId,
            role: 'customer',
            status: 'active',
          },
          { onConflict: 'organization_id,user_id' }
        ),
        existingCustomer
          ? admin
              .from('customers')
              .update({
                name: input.fullName,
                profile_id: userId,
                first_name: firstName,
                last_name: lastName,
                email: input.email,
                phone: input.phone || '',
                status: 'active',
                updated_at: now,
              })
              .eq('id', existingCustomer.id)
              .eq('organization_id', organization.id)
          : admin.from('customers').insert({
              organization_id: organization.id,
              profile_id: userId,
              name: input.fullName,
              first_name: firstName,
              last_name: lastName,
              email: input.email,
              phone: input.phone || '',
              customer_type: 'regular',
              segment: 'new',
              status: 'active',
              created_at: now,
              updated_at: now,
            }),
      ])

      const setupError = setupResults.map(getSupabaseErrorMessage).find(Boolean)

      if (setupError) {
        logger.error('Failed to finish public customer registration', {
          error: setupError,
          userId,
          organizationId: organization.id,
        })

        const needsTenantCustomerIndex =
          setupError.includes('idx_customers_profile_id') ||
          setupError.toLowerCase().includes('duplicate key') ||
          setupError.toLowerCase().includes('customers_profile_id')

        return NextResponse.json(
          {
            success: false,
            code: needsTenantCustomerIndex ? 'tenant_customer_index_required' : 'customer_register_link_failed',
            error: needsTenantCustomerIndex
              ? 'Falta aplicar la migracion multiempresa de clientes. Ejecuta la migracion 20260601010000_customers_profile_tenant_unique.sql.'
              : 'La cuenta fue creada, pero no se pudo vincular como cliente de esta empresa. Contacta soporte.',
          },
          { status: needsTenantCustomerIndex ? 409 : 500 }
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
