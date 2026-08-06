import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  WHOLESALE_PRICE_PERMISSION,
  isLegacyWholesaleRole,
  resolveWholesaleAccessForUser,
} from '@/lib/auth/wholesale-access'

/**
 * Resuelve el registro de cliente y/o perfil a partir de targetId (que puede ser customers.id o profile_id)
 */
async function resolveCustomerTarget(
  admin: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
  targetId: string
) {
  // 1. Buscar en la tabla customers por id o profile_id en la organización
  const { data: customerByAny } = await admin
    .from('customers')
    .select('id, profile_id, customer_type, segment, email')
    .or(`id.eq.${targetId},profile_id.eq.${targetId}`)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (customerByAny) {
    let profileId = customerByAny.profile_id
    if (!profileId && customerByAny.email) {
      // Intentar buscar perfil por email si no estaba vinculado explícitamente
      const { data: profileByEmail } = await admin
        .from('profiles')
        .select('id')
        .eq('email', customerByAny.email)
        .maybeSingle()
      if (profileByEmail?.id) {
        profileId = profileByEmail.id
        // Vincular silenciosamente
        await admin.from('customers').update({ profile_id: profileId }).eq('id', customerByAny.id)
      }
    }

    return {
      customer: customerByAny,
      customerId: customerByAny.id,
      profileId: profileId || null,
    }
  }

  // 2. Si no se encontró por customers, probar si es un user_id de la organización en organization_members
  const { data: member } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('user_id', targetId)
    .maybeSingle()

  if (member) {
    return {
      customer: null,
      customerId: null,
      profileId: targetId,
    }
  }

  return null
}

// POST /api/customers/[id]/set-wholesale — habilita o deshabilita acceso mayorista
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authenticated) {
      return (authResult as Extract<typeof authResult, { authenticated: false }>).response
    }

    const { id: targetId } = await params
    const body = (await request.json().catch(() => ({}))) as { enable?: unknown }
    const { enable } = body

    if (!targetId) {
      return NextResponse.json({ error: 'Se requiere el ID del cliente' }, { status: 400 })
    }
    if (typeof enable !== 'boolean') {
      return NextResponse.json({ error: 'El campo "enable" debe ser boolean' }, { status: 400 })
    }

    const admin = createAdminSupabase()
    const organization = await getCurrentOrganizationContext(authResult.user.id)
    if (!organization) {
      return NextResponse.json({ error: 'Sin organización activa.' }, { status: 403 })
    }

    const target = await resolveCustomerTarget(admin, organization.id, targetId)
    if (!target) {
      return NextResponse.json({ error: 'El cliente no pertenece a tu organización.' }, { status: 403 })
    }

    const { customerId, profileId } = target

    // 1. Actualizar registro en la tabla `customers` (CRM)
    if (customerId) {
      const updates: Record<string, unknown> = {
        customer_type: enable ? 'wholesale' : 'regular',
        updated_at: new Date().toISOString(),
      }
      if (enable) {
        updates.segment = 'wholesale'
      }
      await admin.from('customers').update(updates).eq('id', customerId)
    }

    // 2. Si tiene perfil de usuario (auth), actualizar `user_permissions` y `profiles`
    if (profileId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('id, role')
        .eq('id', profileId)
        .maybeSingle()

      const previousRole = profile?.role

      if (enable) {
        const { data: updatedRows } = await admin
          .from('user_permissions')
          .update({ is_active: true })
          .eq('user_id', profileId)
          .eq('permission', WHOLESALE_PRICE_PERMISSION)
          .eq('organization_id', organization.id)
          .select('id')

        if (!updatedRows || updatedRows.length === 0) {
          await admin.from('user_permissions').insert({
            user_id: profileId,
            organization_id: organization.id,
            permission: WHOLESALE_PRICE_PERMISSION,
            is_active: true,
          })
        }
      } else {
        await admin
          .from('user_permissions')
          .update({ is_active: false })
          .eq('user_id', profileId)
          .eq('permission', WHOLESALE_PRICE_PERMISSION)
          .eq('organization_id', organization.id)

        if (previousRole && isLegacyWholesaleRole(previousRole)) {
          await admin
            .from('profiles')
            .update({ role: 'cliente', updated_at: new Date().toISOString() })
            .eq('id', profileId)

          await admin
            .from('user_roles')
            .upsert(
              { user_id: profileId, role: 'cliente', is_active: true, updated_at: new Date().toISOString() },
              { onConflict: 'user_id' }
            )
        }
      }
    }

    // Registrar en audit log
    try {
      await admin.from('audit_log').insert({
        user_id: authResult.user.id,
        action: enable ? 'enable_wholesale' : 'disable_wholesale',
        resource_type: 'customer',
        resource_id: customerId || profileId,
        new_values: {
          permission: WHOLESALE_PRICE_PERMISSION,
          organization_id: organization.id,
          enabled: enable,
          assigned_by: authResult.user.id,
        },
        created_at: new Date().toISOString(),
      })
    } catch {
      /* no crítico */
    }

    return NextResponse.json({
      success: true,
      isWholesale: enable,
      permission: WHOLESALE_PRICE_PERMISSION,
      message: enable
        ? 'Acceso mayorista habilitado correctamente'
        : 'Acceso mayorista deshabilitado correctamente',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: 'Error interno: ' + msg }, { status: 500 })
  }
}

// GET /api/customers/[id]/set-wholesale — consulta el estado actual mayorista
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authenticated) {
      return (authResult as Extract<typeof authResult, { authenticated: false }>).response
    }

    const { id: targetId } = await params
    const admin = createAdminSupabase()
    const organization = await getCurrentOrganizationContext(authResult.user.id)
    if (!organization) {
      return NextResponse.json({ error: 'Sin organización activa.' }, { status: 403 })
    }

    const target = await resolveCustomerTarget(admin, organization.id, targetId)
    if (!target) {
      return NextResponse.json({ error: 'El cliente no pertenece a tu organización.' }, { status: 403 })
    }

    const { customer, profileId } = target

    let isWholesale = false

    // Verificar en la tabla `customers`
    if (customer) {
      const typeLower = (customer.customer_type || '').toLowerCase()
      const segLower = (customer.segment || '').toLowerCase()
      if (typeLower === 'wholesale' || typeLower === 'mayorista' || segLower === 'wholesale' || segLower === 'mayorista') {
        isWholesale = true
      }
    }

    // Verificar en `user_permissions` si tiene perfil de usuario
    if (!isWholesale && profileId) {
      isWholesale = await resolveWholesaleAccessForUser(admin, profileId, organization.id)
    }

    return NextResponse.json({
      isWholesale,
      permission: WHOLESALE_PRICE_PERMISSION,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: 'Error interno: ' + msg }, { status: 500 })
  }
}
