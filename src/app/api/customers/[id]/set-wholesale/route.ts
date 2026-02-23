import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-auth'

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

    const newRole = enable ? 'mayorista' : 'cliente'
    const previousRole = profile.role

    // Actualizar en profiles (fuente de verdad para el servidor /productos)
    const { error: profileError } = await admin
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', customerId)

    if (profileError) {
      return NextResponse.json(
        { error: 'Error al actualizar perfil: ' + profileError.message },
        { status: 500 }
      )
    }

    // Actualizar en user_roles también (tolerante a fallos)
    try {
      await admin.from('user_roles').upsert(
        { user_id: customerId, role: newRole, is_active: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    } catch { /* no crítico */ }

    // Registrar en audit log
    try {
      await admin.from('audit_log').insert({
        user_id: authResult.user.id,
        action: enable ? 'enable_wholesale' : 'disable_wholesale',
        resource_type: 'user',
        resource_id: customerId,
        new_values: { role: newRole, previous_role: previousRole, assigned_by: authResult.user.id },
        created_at: new Date().toISOString(),
      })
    } catch { /* no crítico */ }

    return NextResponse.json({
      success: true,
      isWholesale: enable,
      role: newRole,
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

    const { data: profile, error } = await admin
      .from('profiles')
      .select('role')
      .eq('id', customerId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const isWholesale = profile?.role === 'mayorista' || profile?.role === 'client_mayorista'
    return NextResponse.json({ isWholesale, role: profile?.role ?? null })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: 'Error interno: ' + msg }, { status: 500 })
  }
}
