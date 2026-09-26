import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { z } from 'zod'

const linkSchema = z.object({
  email: z.string().trim().email('Email inválido'),
})

async function getCustomerId(routeContext: unknown): Promise<string | null> {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = params ? await Promise.resolve(params) : null
  return resolved?.id ?? null
}

/**
 * POST /api/customers/[id]/link-account
 * Vincula un cliente existente a una cuenta autenticada por email.
 * Busca el usuario en auth.users y setea profile_id en el customer.
 */
export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (request, { organization }, routeContext) => {
  try {
    const customerId = await getCustomerId(routeContext)
    if (!customerId) return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })
    const body = await request.json()
    const validation = linkSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Email inválido', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { email } = validation.data
    const supabase = createAdminSupabase()

    // Verificar que el cliente existe y pertenece a la organización
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, profile_id')
      .eq('id', customerId)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    if (customer.profile_id) {
      return NextResponse.json(
        { error: 'Este cliente ya tiene una cuenta vinculada' },
        { status: 409 }
      )
    }

    // Buscar usuario en auth por email
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      return NextResponse.json({ error: 'Error al buscar usuarios' }, { status: 500 })
    }

    const users = usersData?.users ?? []
    const authUser = users.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase())

    if (!authUser) {
      return NextResponse.json(
        { error: `No existe una cuenta registrada con el email "${email}". El cliente debe registrarse primero.` },
        { status: 404 }
      )
    }

    // Verificar que no haya otro customer en esta org con este profile_id
    const { data: existing } = await supabase
      .from('customers')
      .select('id, name')
      .eq('organization_id', organization.id)
      .eq('profile_id', authUser.id)
      .neq('id', customerId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `Esta cuenta ya está vinculada a otro cliente: "${existing.name}"` },
        { status: 409 }
      )
    }

    // Vincular
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        profile_id: authUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .eq('organization_id', organization.id)

    if (updateError) {
      return NextResponse.json({ error: 'No se pudo vincular la cuenta' }, { status: 500 })
    }

    // Asegurar membership como customer en la org
    await supabase.from('organization_members').upsert(
      {
        organization_id: organization.id,
        user_id: authUser.id,
        role: 'customer',
        status: 'active',
      },
      { onConflict: 'organization_id,user_id' }
    )

    return NextResponse.json({
      success: true,
      message: `Cliente vinculado correctamente a ${email}`,
      linkedEmail: email,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/customers/[id]/link-account
 * Desvincula la cuenta autenticada de un cliente.
 */
export const DELETE = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (_request, { organization }, routeContext) => {
  try {
    const customerId = await getCustomerId(routeContext)
    if (!customerId) return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })
    const supabase = createAdminSupabase()

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, profile_id')
      .eq('id', customerId)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (customerError) return NextResponse.json({ error: 'No se pudo validar el cliente' }, { status: 500 })
    if (!customer) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const { error } = await supabase
      .from('customers')
      .update({ profile_id: null, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .eq('organization_id', organization.id)

    if (error) {
      return NextResponse.json({ error: 'No se pudo desvincular' }, { status: 500 })
    }

    if (customer.profile_id) {
      const membership = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', organization.id)
        .eq('user_id', customer.profile_id)
        .eq('role', 'customer')

      if (membership.error) {
        return NextResponse.json({ error: 'La cuenta se desvinculó, pero no se pudo quitar su acceso de cliente.' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Cuenta desvinculada' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
})
