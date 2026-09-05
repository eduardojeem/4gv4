import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth, type TenantAuthContext } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  DEFAULT_RECEIPT_SETTINGS,
  normalizeRepairReceiptSettings,
  RepairReceiptSettingsSchema,
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

async function updateSettings(request: NextRequest, context: TenantAuthContext) {
  const body = await request.json().catch(() => null)
  const validation = RepairReceiptSettingsSchema.safeParse(body?.settings)
  if (!validation.success) {
    return NextResponse.json({
      success: false,
      error: validation.error.issues[0]?.message || 'La configuración contiene valores inválidos.',
    }, { status: 422 })
  }

  const next = normalizeRepairReceiptSettings(validation.data)
  const supabase = createAdminSupabase()
  const { data: previousRow, error: previousError } = await supabase
    .from('organization_settings')
    .select('repair_receipt_settings')
    .eq('organization_id', context.organization.id)
    .maybeSingle()

  if (previousError) {
    return NextResponse.json({ success: false, error: 'No se pudo verificar la configuración actual.' }, { status: 500 })
  }

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
    metadata: { previous: previousRow?.repair_receipt_settings ?? DEFAULT_RECEIPT_SETTINGS, next },
  })

  if (auditError) {
    await supabase.from('organization_settings').update({
      repair_receipt_settings: previousRow?.repair_receipt_settings ?? null,
      updated_at: new Date().toISOString(),
    }).eq('organization_id', context.organization.id)
    return NextResponse.json({
      success: false,
      error: 'No se pudo registrar la trazabilidad. No se aplicaron los cambios.',
    }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: next, organizationId: context.organization.id })
}

export const GET = withTenantAuth(
  { permission: 'repairs.orders.read', module: 'repairs' },
  getSettings
)

export const PUT = withTenantAuth(
  { permission: 'settings.manage', module: 'repairs' },
  updateSettings
)
