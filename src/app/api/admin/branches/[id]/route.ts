import { NextResponse } from 'next/server'
import { requireAdmin, getAuthResponse } from '@/lib/auth/require-auth'
import { createAdminSupabase } from '@/lib/supabase/admin'

type BranchUpdatePayload = {
  name?: unknown
  code?: unknown
  slug?: unknown
  address?: unknown
  city?: unknown
  phone?: unknown
  email?: unknown
  manager_name?: unknown
  is_active?: unknown
  is_default?: unknown
}

function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toOptionalText(value: unknown) {
  const normalized = toText(value)
  return normalized.length > 0 ? normalized : null
}

function toBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const { id } = await context.params
    const body = await request.json() as BranchUpdatePayload

    if (!id) {
      return NextResponse.json({ error: 'Sucursal inválida.' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}
    const name = toText(body.name)
    const code = toText(body.code)
    const slug = toText(body.slug)

    if (name) patch.name = name
    if (code) patch.code = code.toUpperCase()
    if (slug) patch.slug = slug
    if ('address' in body) patch.address = toOptionalText(body.address)
    if ('city' in body) patch.city = toOptionalText(body.city)
    if ('phone' in body) patch.phone = toOptionalText(body.phone)
    if ('email' in body) patch.email = toOptionalText(body.email)
    if ('manager_name' in body) patch.manager_name = toOptionalText(body.manager_name)

    const isActive = toBoolean(body.is_active)
    const isDefault = toBoolean(body.is_default)

    if (typeof isActive === 'boolean') patch.is_active = isActive
    if (typeof isDefault === 'boolean') patch.is_default = isDefault

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No hay cambios para aplicar.' }, { status: 400 })
    }

    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from('branches')
      .update(patch)
      .eq('id', id)
      .select('id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .single()

    if (error || !data) {
      const status = error?.message?.includes('duplicate') || error?.message?.includes('unique') ? 409 : 500
      return NextResponse.json(
        { error: error?.message || 'No se pudo actualizar la sucursal.' },
        { status }
      )
    }

    return NextResponse.json({ branch: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
