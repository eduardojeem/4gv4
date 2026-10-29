import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  getNotificationMetadata,
  type NotificationType,
} from '../types'
import {
  roleHasPermission,
  mapLegacyRoleToOrganizationRole,
  type OrganizationRole,
  type Permission,
} from '@/lib/saas/permissions'

export interface ResolvedMember {
  userId: string
  role: OrganizationRole
  email?: string
}

export interface RecipientResolutionResult {
  candidates: ResolvedMember[]
  eligible: ResolvedMember[]
  skippedByBranch: number
  skippedByPermission: number
}

interface MemberRow {
  user_id: string
  role: string
  status: string
}

interface AssignmentRow {
  user_id: string
  branch_id: string
  is_active: boolean
}

/**
 * Resuelve los destinatarios elegibles dentro de una organización para un evento dado.
 * Aplica aislamiento estricto multi-tenant, visibilidad de sucursales, permisos y filtros personales.
 */
export async function resolveRecipients(params: {
  organizationId: string
  branchId?: string | null
  type: NotificationType
  targetUserIds?: string[]
}): Promise<RecipientResolutionResult> {
  const { organizationId, branchId, type, targetUserIds } = params
  const metadata = getNotificationMetadata(type)
  const supabase = createAdminSupabase()

  // 1. Obtener todos los miembros activos de la organización
  const { data: membersData, error: membersError } = await supabase
    .from('organization_members')
    .select('user_id, role, status')
    .eq('organization_id', organizationId)
    .eq('status', 'active')

  if (membersError || !membersData) {
    return {
      candidates: [],
      eligible: [],
      skippedByBranch: 0,
      skippedByPermission: 0,
    }
  }

  const rawMembers = membersData as MemberRow[]
  const candidates: ResolvedMember[] = rawMembers.map((m) => ({
    userId: m.user_id,
    role: mapLegacyRoleToOrganizationRole(m.role),
  }))

  // 2. Si el evento es personal (e.g. REPAIR_ASSIGNED, PASSWORD_CHANGED), requiere targetUserIds
  if (metadata.personal && (!targetUserIds || targetUserIds.length === 0)) {
    return {
      candidates,
      eligible: [],
      skippedByBranch: 0,
      skippedByPermission: 0,
    }
  }

  // 3. Si se suministró targetUserIds (sea personal o dirigido), limitar a ellos
  let preFiltered = candidates
  if (targetUserIds && targetUserIds.length > 0) {
    const targetSet = new Set(targetUserIds)
    preFiltered = candidates.filter((c) => targetSet.has(c.userId))
  }

  // 4. Si hay branchId, resolver asignaciones activas de sucursal
  const assignedUserIds = new Set<string>()
  if (branchId) {
    const { data: assignmentsData } = await supabase
      .from('user_branch_assignments')
      .select('user_id, branch_id, is_active')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId)
      .eq('is_active', true)

    if (assignmentsData) {
      for (const row of assignmentsData as AssignmentRow[]) {
        assignedUserIds.add(row.user_id)
      }
    }
  }

  const eligible: ResolvedMember[] = []
  let skippedByBranch = 0
  let skippedByPermission = 0

  for (const member of preFiltered) {
    // A. Verificación de Sucursal:
    // Los dueños y administradores tienen visibilidad global en todas las sucursales del negocio.
    // El personal operativo debe tener asignación activa en la sucursal del evento.
    if (branchId) {
      const isOwnerOrAdmin = member.role === 'owner' || member.role === 'admin'
      const isAssigned = assignedUserIds.has(member.userId)

      if (!isOwnerOrAdmin && !isAssigned) {
        skippedByBranch++
        continue
      }
    }

    // B. Verificación de Permisos / Rol:
    if (metadata.requiredPermission) {
      const hasPerm = roleHasPermission(member.role, metadata.requiredPermission as Permission)
      if (!hasPerm) {
        skippedByPermission++
        continue
      }
    }

    eligible.push(member)
  }

  return {
    candidates,
    eligible,
    skippedByBranch,
    skippedByPermission,
  }
}
