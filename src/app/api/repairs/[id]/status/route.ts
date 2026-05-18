import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'

type RepairStage = 'recibido' | 'diagnostico' | 'reparacion' | 'pausado' | 'listo' | 'entregado' | 'cancelado'

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

function buildStatusUpdate(stage: RepairStage): Record<string, unknown> {
  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = {
    status: stage,
    updated_at: now,
  }

  if (stage === 'listo') {
    updateData.completed_at = now
  }
  if (stage === 'entregado') {
    updateData.delivered_at = now
  }

  return updateData
}

// PATCH /api/repairs/:id/status -> Updates repair status only (no automatic WhatsApp)
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>

    const { id } = await context.params
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const stage = normalizeStage(body?.stage ?? body?.status)

    if (!id || !stage) {
      return NextResponse.json({ ok: false, error: 'invalid_or_missing_stage' }, { status: 400 })
    }

    const isConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    if (!isConfigured) {
      return NextResponse.json({ ok: true, id, stage, demo: true })
    }

    const supabase = createAdminSupabase()
    const requestedBranchId = getRequestedBranchId(req)
    const branchScope = await resolveBranchScopeForUser({
      userId: staffAuth.user.id,
      role: staffAuth.role,
      requestedBranchId,
      strict: Boolean(requestedBranchId),
    })

    if (!branchScope.branchId) {
      return NextResponse.json(
        { ok: false, error: 'No hay una sucursal operativa disponible para actualizar la reparacion.' },
        { status: 400 }
      )
    }

    const { data: updatedRepair, error: updateError } = await supabase
      .from('repairs')
      .update(buildStatusUpdate(stage))
      .eq('id', id)
      .eq('branch_id', branchScope.branchId)
      .select('id')
      .maybeSingle()

    if (updateError) throw updateError
    if (!updatedRepair) {
      return NextResponse.json({ ok: false, error: 'repair_not_found' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      id,
      stage,
    })
  } catch (e: unknown) {
    console.error('PATCH /api/repairs/[id]/status error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
