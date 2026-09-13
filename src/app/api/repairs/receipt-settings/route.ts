import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, type TenantAuthContext } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  DEFAULT_RECEIPT_SETTINGS,
  mergeRepairReceiptSettings,
  normalizeRepairReceiptSettings,
  RepairReceiptSettingsSchema,
  type RepairReceiptSettings,
} from '@/lib/repairs/receipt-settings'
import { roleHasPermission, type OrganizationRole } from '@/lib/saas/permissions'

async function getSettings(_request: NextRequest, context: TenantAuthContext) {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('organization_settings')
    .select('repair_receipt_settings')
    .eq('organization_id', context.organization.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ success: false, error: 'No se pudo cargar la configuración del comprobante.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: normalizeRepairReceiptSettings(data?.repair_receipt_settings),
    organizationId: context.organization.id,
    persisted: Boolean(data?.repair_receipt_settings),
    canEdit: roleHasPermission(context.organization.role as OrganizationRole, 'settings.manage'),
  })
}

async function readSettingsBody(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const validation = RepairReceiptSettingsSchema.safeParse(body?.settings)
  if (!validation.success) {
    return {
      error: NextResponse.json({
        success: false,
        error: validation.error.issues[0]?.message || 'La configuración contiene valores inválidos.',
      }, { status: 422 }),
    }
  }
  return { patch: validation.data }
}

/**
 * Guarda y deja registro. Si la auditoría falla se revierte: un cambio en lo
 * que firma el cliente no puede quedar sin trazabilidad.
 */
async function persist(
  context: TenantAuthContext,
  build: (current: unknown) => RepairReceiptSettings
) {
  const supabase = createAdminSupabase()
  const { data: previousRow, error: previousError } = await supabase
    .from('organization_settings')
    .select('repair_receipt_settings')
    .eq('organization_id', context.organization.id)
    .maybeSingle()

  if (previousError) {
    return NextResponse.json({ success: false, error: 'No se pudo verificar la configuración actual.' }, { status: 500 })
  }

  const previous = previousRow?.repair_receipt_settings ?? null
  const next = build(previous)

  const { error: updateError } = await supabase.from('organization_settings').upsert({
    organization_id: context.organization.id,
    repair_receipt_settings: next,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id' })

  if (updateError) {
    return NextResponse.json({ success: false, error: 'No se pudo guardar la configuración del comprobante.' }, { status: 500 })
  }

  const { error: auditError } = await supabase.from('tenant_audit_log').insert({
    organization_id: context.organization.id,
    user_id: context.user.id,
    action: 'repair_receipt_settings.updated',
    resource: 'organization_settings',
    resource_id: context.organization.id,
    metadata: { previous: previous ?? DEFAULT_RECEIPT_SETTINGS, next },
  })

  if (auditError) {
    await supabase.from('organization_settings').update({
      repair_receipt_settings: previous,
      updated_at: new Date().toISOString(),
    }).eq('organization_id', context.organization.id)
    return NextResponse.json({
      success: false,
      error: 'No se pudo registrar la trazabilidad. No se aplicaron los cambios.',
    }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: next, organizationId: context.organization.id })
}

/** Reemplaza la configuración entera. Lo que no venga vuelve a su valor por defecto. */
async function replaceSettings(request: NextRequest, context: TenantAuthContext) {
  const parsed = await readSettingsBody(request)
  if (parsed.error) return parsed.error
  return persist(context, () => normalizeRepairReceiptSettings(parsed.patch))
}

/**
 * Cambia solo los campos enviados y conserva el resto de lo guardado.
 *
 * El formulario de nueva reparación y Ajustes guardaban la garantía mandando la
 * configuración entera que habían leído al abrir. Si esa lectura había fallado,
 * mandaban los valores de fábrica y reseteaban papel, logo y texto legal de toda
 * la empresa; y si otra persona había cambiado el papel mientras tanto, lo
 * pisaban. Fusionar en el servidor evita las dos cosas.
 */
async function patchSettings(request: NextRequest, context: TenantAuthContext) {
  const parsed = await readSettingsBody(request)
  if (parsed.error) return parsed.error
  if (Object.keys(parsed.patch).length === 0) {
    return NextResponse.json({ success: false, error: 'No hay cambios para guardar.' }, { status: 422 })
  }
  return persist(context, (current) => mergeRepairReceiptSettings(current, parsed.patch))
}

export const GET = withTenantAuth(
  { permission: 'repairs.orders.read', module: 'repairs' },
  getSettings
)

export const PUT = withTenantAuth(
  { permission: 'settings.manage', module: 'repairs' },
  replaceSettings
)

export const PATCH = withTenantAuth(
  { permission: 'settings.manage', module: 'repairs' },
  patchSettings
)
