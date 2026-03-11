import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-auth'
import {
  WHOLESALE_PRICE_PERMISSION,
  isLegacyWholesaleRole,
  resolveWholesaleAccessForUser,
} from '@/lib/auth/wholesale-access'

// POST /api/customers/[id]/set-wholesale — habilita o deshabilita acceso mayorista
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin()
    // requireAdmin returns a discriminated union; narrow with explicit check
    if (!authResult.authenticated) {
      return (authResult as Extract<typeof authResult, { authenticated: false }>).response
    }

    const { id: customerId } = await params
    const body = await request.json() as { enable?: unknown }
    const { enable } = body

    if (!customerId) {
      return NextResponse.json({ error: 'Se requiere el ID del cliente' }, { status: 400 })
    }
    if (typeof enable !== 'boolean') {
      return NextResponse.json({ error: 'El campo "enable" debe ser boolean' }, { status: 400 })
    }

    const admin = createAdminSupabase()

    // Verificar que el perfil exista
    const { data: profile, error: fetchError } = await admin
      .from('profiles')
      .select('id, role, email')
      .eq('id', customerId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json(
        { error: 'Error al buscar el perfil: ' + fetchError.message },
        { status: 500 }
      )
    }
    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const previousRole = profile.role

    // Enable/disable explicit wholesale permission
    if (enable) {
      const { data: updatedRows, error: reactivateError } = await admin
        .from('user_permissions')
        .update({ is_active: true })
        .eq('user_id', customerId)
        .eq('permission', WHOLESALE_PRICE_PERMISSION)
        .select('id')

      if (reactivateError) {
        return NextResponse.json(
          { error: 'Error al activar permiso mayorista: ' + reactivateError.message },
          { status: 500 }
        )
      }

      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertPermError } = await admin.from('user_permissions').insert({
          user_id: customerId,
          permission: WHOLESALE_PRICE_PERMISSION,
          is_active: true,
        })

        if (insertPermError) {
          return NextResponse.json(
            { error: 'Error al asignar permiso mayorista: ' + insertPermError.message },
            { status: 500 }
          )
        }
      }
    } else {
      const { error: disablePermError } = await admin
        .from('user_permissions')
        .update({ is_active: false })
        .eq('user_id', customerId)
        .eq('permission', WHOLESALE_PRICE_PERMISSION)

      if (disablePermError) {
        return NextResponse.json(
          { error: 'Error al revocar permiso mayorista: ' + disablePermError.message },
          { status: 500 }
        )
      }

      // Normalize legacy wholesale role to cliente when disabling access.
      if (isLegacyWholesaleRole(previousRole)) {
        await admin
          .from('profiles')
          .update({ role: 'cliente', updated_at: new Date().toISOString() })
          .eq('id', customerId)

        await admin
          .from('user_roles')
          .upsert(
            { user_id: customerId, role: 'cliente', is_active: true, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          )
      }
    }

    // Registrar en audit log
    try {
      await admin.from('audit_log').insert({
        user_id: authResult.user.id,
        action: enable ? 'enable_wholesale' : 'disable_wholesale',
        resource_type: 'user',
        resource_id: customerId,
        new_values: {
          permission: WHOLESALE_PRICE_PERMISSION,
          enabled: enable,
          previous_role: previousRole,
          assigned_by: authResult.user.id,
        },
        created_at: new Date().toISOString(),
      })
    } catch { /* no crítico */ }

    const isWholesale = await resolveWholesaleAccessForUser(admin, customerId)

    return NextResponse.json({
      success: true,
      isWholesale,
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

// GET /api/customers/[id]/set-wholesale — consulta el estado actual
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if (!authResult.authenticated) {
      return (authResult as Extract<typeof authResult, { authenticated: false }>).response
    }

    const { id: customerId } = await params
    const admin = createAdminSupabase()

    const { data: profile, error } = await admin.from('profiles').select('role').eq('id', customerId).maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const isWholesale = await resolveWholesaleAccessForUser(admin, customerId, profile?.role)
    return NextResponse.json({
      isWholesale,
      role: profile?.role ?? null,
      permission: WHOLESALE_PRICE_PERMISSION,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: 'Error interno: ' + msg }, { status: 500 })
  }
}
