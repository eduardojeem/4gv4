import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

const customerLinkSchema = z.object({
  organizationSlug: z.string().trim().min(1).max(64),
})

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  return {
    firstName: parts[0] || 'Cliente',
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

function isTenantCustomerIndexError(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('idx_customers_profile_id') ||
    normalized.includes('duplicate key') ||
    normalized.includes('customers_profile_id') ||
    normalized.includes('customers_profile_id_key') ||
    normalized.includes('profile_id_key') ||
    normalized.includes('duplicate key value violates unique constraint') ||
    (normalized.includes('profile_id') && normalized.includes('unique'))
  )
}

function customerLinkError(message: string) {
  const needsTenantCustomerIndex = isTenantCustomerIndexError(message)

  return NextResponse.json(
    {
      success: false,
      code: needsTenantCustomerIndex ? 'tenant_customer_index_required' : 'customer_link_failed',
      error: needsTenantCustomerIndex
        ? 'Falta aplicar la migracion multiempresa de clientes. Ejecuta la migracion 20260601010000_customers_profile_tenant_unique.sql.'
        : 'No se pudo vincular la cuenta como cliente de esta empresa.',
      detail: process.env.NODE_ENV === 'development' ? message : undefined,
    },
    { status: needsTenantCustomerIndex ? 409 : 500 }
  )
}

async function runLinkStep<T>(step: string, action: PromiseLike<T>) {
  const result = await action
  const errorMessage = getSupabaseErrorMessage(result)

  if (errorMessage) {
    throw new Error(`${step}: ${errorMessage}`)
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const validation = customerLinkSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const admin = createAdminSupabase()
    const { organizationSlug } = validation.data

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', organizationSlug)
      .maybeSingle()

    if (organizationError || !organization) {
      return NextResponse.json({ success: false, error: 'Empresa no encontrada.' }, { status: 404 })
    }

    const { data: membership } = await admin
      .from('organization_members')
      .select('role, status')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .maybeSingle()

    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Cliente'
    const email = user.email || ''
    const phone = String(user.user_metadata?.phone || user.phone || '').trim()
    const { firstName, lastName } = splitName(fullName)
    const now = new Date().toISOString()

    let { data: existingCustomer } = await admin
      .from('customers')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('profile_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!existingCustomer && email) {
      const { data: emailCustomer } = await admin
        .from('customers')
        .select('id')
        .eq('organization_id', organization.id)
        .ilike('email', email)
        .limit(1)
        .maybeSingle()

      existingCustomer = emailCustomer
    }

    if (!existingCustomer && phone) {
      const { data: phoneCustomer } = await admin
        .from('customers')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('phone', phone)
        .limit(1)
        .maybeSingle()

      existingCustomer = phoneCustomer
    }

    if (!membership || membership.role === 'customer') {
      await runLinkStep(
        'organization_members',
        admin.from('organization_members').upsert(
          {
            organization_id: organization.id,
            user_id: user.id,
            role: 'customer',
            status: 'active',
          },
          { onConflict: 'organization_id,user_id' }
        )
      )
    }

    const { data: existingProfile, error: existingProfileError } = await admin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfileError) {
      throw new Error(`profiles.lookup: ${existingProfileError.message}`)
    }

    await runLinkStep(
      'profiles',
      existingProfile
        ? admin
            .from('profiles')
            .update({
              email,
              full_name: fullName,
              status: 'active',
            })
            .eq('id', user.id)
        : admin.from('profiles').insert({
            id: user.id,
            email,
            full_name: fullName,
            role: 'cliente',
            status: 'active',
          })
    )

    await runLinkStep(
      'customers',
      existingCustomer
        ? admin
            .from('customers')
            .update({
              profile_id: user.id,
              name: fullName,
              first_name: firstName,
              last_name: lastName,
              email,
              phone,
              status: 'active',
              updated_at: now,
            })
            .eq('id', existingCustomer.id)
            .eq('organization_id', organization.id)
        : admin.from('customers').insert({
            organization_id: organization.id,
            profile_id: user.id,
            name: fullName,
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            customer_type: 'regular',
            segment: 'new',
            status: 'active',
            created_at: now,
            updated_at: now,
          }),
    )

    const { data: linkedCustomer, error: linkedCustomerError } = await admin
      .from('customers')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (linkedCustomerError || !linkedCustomer) {
      const message = linkedCustomerError?.message || 'customer row was not created'
      logger.error('Failed to verify linked tenant customer', {
        error: message,
        userId: user.id,
        organizationId: organization.id,
      })

      return customerLinkError(`customers.verify: ${message}`)
    }

    return NextResponse.json({
      success: true,
      data: {
        organization,
        role: membership?.role || 'customer',
        customerMode: true,
      },
    })
  } catch (error) {
    logger.error('Public customer link API error', { error })
    return customerLinkError(error instanceof Error ? error.message : 'Error inesperado al vincular el cliente.')
  }
}
