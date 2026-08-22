import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { roleHasPermission } from '@/lib/saas/permissions'
import { FULL_REPAIR_SELECT } from '@/app/api/repairs/_lib'
import { canTransition } from '@/lib/repairs/state-machine'
import type { RepairStatus } from '@/types/repairs'

type RepairStage = RepairStatus

const VALID_STAGES: RepairStage[] = [
  'recibido',
  'diagnostico',
  'reparacion',
  'pausado',
  'listo',
  'entregado',
  'cancelado',
]

const STAGE_ALIASES: Record<string, RepairStage> = {
  ready: 'listo',
  complete: 'listo',
  completed: 'listo',
  delivered: 'entregado',
  delivery: 'entregado',
  cancelled: 'cancelado',
  canceled: 'cancelado',
  paused: 'pausado',
  pause: 'pausado',
  pending: 'recibido',
  received: 'recibido',
  diagnostic: 'diagnostico',
  repair: 'reparacion',
  in_repair: 'reparacion',
}

function normalizeStage(input: unknown): RepairStage | null {
  if (typeof input !== 'string') return null
  const raw = input.trim().toLowerCase()
  const mapped = STAGE_ALIASES[raw] || raw
  return VALID_STAGES.includes(mapped as RepairStage) ? (mapped as RepairStage) : null
}

function buildStatusUpdate(stage: RepairStage, currentCompletedAt: string | null): Record<string, unknown> {
  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = {
    status: stage,
    updated_at: now,
  }

  // Solo setear completed_at la primera vez que llega a "listo"
  if (stage === 'listo' && !currentCompletedAt) {
    updateData.completed_at = now
  }
  if (stage === 'entregado') {
    updateData.delivered_at = now
    updateData.picked_up_at = now
    // Solo setear completed_at si nunca se completó
    if (!currentCompletedAt) {
      updateData.completed_at = now
    }
  }

  return updateData
}

// PATCH /api/repairs/:id/status
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
    const organization = await getCurrentOrganizationContext(staffAuth.user.id)

    if (!organization) {
      return NextResponse.json({ ok: false, error: 'organization_required' }, { status: 403 })
    }
    if (!roleHasPermission(organization.role, 'repairs.orders.update')) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const stage = normalizeStage(body?.stage ?? body?.status)
    const note = typeof body?.note === 'string' ? body.note.trim() : null

    if (!id || !stage) {
      return NextResponse.json({ ok: false, error: 'invalid_or_missing_stage' }, { status: 400 })
    }

    if (stage === 'entregado') {
      return NextResponse.json(
        {
          ok: false,
          error: 'La entrega debe registrar resultado, garantia y estado financiero.',
          code: 'USE_DELIVERY_ENDPOINT',
        },
        { status: 409 },
      )
    }

    const supabase = createAdminSupabase()
    const requestedBranchId = getRequestedBranchId(req)
    const branchScope = await resolveBranchScopeForUser({
      userId: staffAuth.user.id,
      role: staffAuth.role,
      requestedBranchId,
      organizationId: organization.id,
      strict: Boolean(requestedBranchId),
    })

    if (!branchScope.branchId) {
      return NextResponse.json(
        { ok: false, error: 'No hay una sucursal operativa disponible para actualizar la reparacion.' },
        { status: 400 }
      )
    }

    // Obtener estado actual de la reparación
    const { data: currentRepair, error: fetchError } = await supabase
      .from('repairs')
      .select('id, status, technician_id, completed_at')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .eq('branch_id', branchScope.branchId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!currentRepair) {
      return NextResponse.json({ ok: false, error: 'repair_not_found' }, { status: 404 })
    }

    const currentStatus = currentRepair.status as RepairStage

    // Validar transición con la state machine
    const validation = canTransition(currentStatus, stage, {
      technician_id: currentRepair.technician_id,
    })

    if (!validation.allowed) {
      return NextResponse.json(
        { ok: false, error: validation.reason || 'Transición de estado no permitida' },
        { status: 422 }
      )
    }

    // Si es el mismo estado, no hacer nada
    if (currentStatus === stage) {
      const { data: repair } = await supabase
        .from('repairs')
        .select(FULL_REPAIR_SELECT)
        .eq('id', id)
        .maybeSingle()

      return NextResponse.json({ ok: true, id, stage, repair })
    }

    // Aplicar el cambio de estado
    const updateData = buildStatusUpdate(stage, currentRepair.completed_at)

    const { data: updatedRepair, error: updateError } = await supabase
      .from('repairs')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', organization.id)
      .eq('branch_id', branchScope.branchId)
      .select(FULL_REPAIR_SELECT)
      .maybeSingle()

    if (updateError) throw updateError
    if (!updatedRepair) {
      return NextResponse.json({ ok: false, error: 'repair_not_found' }, { status: 404 })
    }

    // Registrar en historial de cambios de estado
    await supabase.from('repair_status_history').insert({
      repair_id: id,
      organization_id: organization.id,
      old_status: currentStatus,
      new_status: stage,
      changed_by: staffAuth.user.id,
      notes: note,
    })

    return NextResponse.json({
      ok: true,
      id,
      stage,
      repair: updatedRepair,
    })
  } catch (e: unknown) {
    console.error('PATCH /api/repairs/[id]/status error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
