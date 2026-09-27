import type { RepairQualityCheckRequest, RepairQualityCheckResult } from './quality-check'

type RpcError = { message?: string; code?: string }
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>
}

export type RepairQualityCheckRpcResult = {
  repair_id: string
  quality_check_id: string
  result: RepairQualityCheckResult
  status: 'listo' | 'reparacion'
  checked_at: string
}

const ERRORS: Record<string, { status: number; message: string }> = {
  REPAIR_NOT_FOUND: { status: 404, message: 'Reparación no encontrada.' },
  REPAIR_QUALITY_INVALID_STATE: { status: 409, message: 'No se puede verificar un equipo entregado o cancelado.' },
  REPAIR_TECHNICIAN_REQUIRED: { status: 422, message: 'Asigná un técnico antes de completar la verificación.' },
  REPAIR_QUALITY_CHECKLIST_INCOMPLETE: { status: 422, message: 'Completá todos los controles antes de aprobar el funcionamiento.' },
  REPAIR_QUALITY_NOTE_REQUIRED: { status: 422, message: 'Explicá qué falló o por qué el equipo no fue reparado.' },
}

export class RepairQualityCheckRpcError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message)
    this.name = 'RepairQualityCheckRpcError'
  }
}

export async function recordRepairQualityCheck(client: RpcClient, input: {
  repairId: string
  organizationId: string
  branchId: string
  actorId: string
  request: RepairQualityCheckRequest
}) {
  const { data, error } = await client.rpc('record_repair_quality_check', {
    p_repair_id: input.repairId,
    p_organization_id: input.organizationId,
    p_branch_id: input.branchId,
    p_actor_id: input.actorId,
    p_result: input.request.result,
    p_checklist: input.request.checklist,
    p_note: input.request.note ?? null,
  })
  if (error) {
    const raw = error.message ?? ''
    const code = Object.keys(ERRORS).find((candidate) => raw.includes(candidate)) ?? 'REPAIR_QUALITY_CHECK_FAILED'
    const detail = ERRORS[code] ?? { status: 500, message: 'No se pudo guardar la verificación técnica.' }
    throw new RepairQualityCheckRpcError(detail.message, code, detail.status)
  }
  return data as RepairQualityCheckRpcResult
}
