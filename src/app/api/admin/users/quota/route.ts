import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { canCreateResource } from '@/lib/saas/subscription-service'
import { createAdminSupabase } from '@/lib/supabase/admin'

type ActiveMemberRow = {
  id: string
  user_id: string
  role: string | null
  created_at: string | null
}

function rolePriority(role: string | null) {
  if (role === 'owner') return 0
  if (role === 'admin') return 1
  if (role === 'technician' || role === 'seller') return 2
  return 3
}

async function enforceActiveUserLimit(organizationId: string, limit: number, currentUserId: string) {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, user_id, role, created_at')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .neq('role', 'customer')

  if (error) throw error

  const activeMembers = (data ?? []) as ActiveMemberRow[]
  if (activeMembers.length <= limit) return 0

  const sorted = [...activeMembers].sort((a, b) => {
    if (a.user_id === currentUserId && b.user_id !== currentUserId) return -1
    if (b.user_id === currentUserId && a.user_id !== currentUserId) return 1

    const byRole = rolePriority(a.role) - rolePriority(b.role)
    if (byRole !== 0) return byRole

    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
    return aCreated - bCreated
  })

  const keepIds = new Set(sorted.slice(0, limit).map((member) => member.id))
  const suspendIds = sorted
    .filter((member) => !keepIds.has(member.id))
    .map((member) => member.id)

  if (suspendIds.length === 0) return 0

  const { error: updateError } = await supabase
    .from('organization_members')
    .update({ status: 'suspended' })
    .in('id', suspendIds)

  if (updateError) throw updateError
  return suspendIds.length
}

async function buildUsersQuotaResponse(context: AdminAuthContext, enforcedSuspensions = 0) {
  if (!context.organizationId) {
    return NextResponse.json({
      success: true,
      allowed: true,
      blocked: false,
      overLimit: false,
      expired: false,
      enforcedSuspensions: 0,
      current: 0,
      limit: null,
      plan: { code: 'GLOBAL', name: 'Acceso global' },
      message: 'Los super administradores no tienen limite de usuarios por organizacion.',
    })
  }

  const quota = await canCreateResource(context.organizationId, 'users')
  const planName = quota.plan?.name || quota.plan?.code || 'actual'
  const limitText = quota.limit === null ? 'ilimitados' : `${quota.limit}`
  const overLimit = quota.limit !== null && quota.current > quota.limit

  let message = `Plan ${planName}: ${quota.current}/${limitText} usuarios activos.`

  if (quota.blocked) {
    message = 'La suscripcion esta suspendida o cancelada. Reactivala para habilitar mas accesos.'
  } else if (enforcedSuspensions > 0 && quota.expired) {
    message = `El plan vencio y se aplico el limite Free: ${quota.current}/${limitText} usuarios activos. Se suspendieron ${enforcedSuspensions} usuario(s) que excedian el cupo.`
  } else if (enforcedSuspensions > 0) {
    message = `Plan ${planName}: ${quota.current}/${limitText} usuarios activos. Se suspendieron ${enforcedSuspensions} usuario(s) que excedian el cupo.`
  } else if (quota.expired && overLimit) {
    message = `El plan vencio y ahora aplica el limite Free de ${limitText} usuarios activos. Suspende ${quota.current - (quota.limit ?? 0)} usuario(s) activo(s) o actualiza el plan.`
  } else if (quota.expired) {
    message = `El plan vencio y ahora aplica el limite Free: ${quota.current}/${limitText} usuarios activos.`
  } else if (overLimit) {
    message = `Tu plan ${planName} permite ${limitText} usuarios activos. Suspende ${quota.current - (quota.limit ?? 0)} usuario(s) activo(s) o actualiza el plan.`
  } else if (!quota.allowed) {
    message = `Tu plan ${planName} ya alcanzo el limite de ${limitText} usuarios activos. Suspende un usuario activo o actualiza el plan para habilitar mas accesos.`
  }

  return NextResponse.json({
    success: true,
    allowed: quota.allowed,
    blocked: Boolean(quota.blocked),
    overLimit,
    expired: Boolean(quota.expired),
    enforcedSuspensions,
    current: quota.current,
    limit: quota.limit,
    plan: {
      code: quota.plan?.code,
      name: quota.plan?.name,
    },
    message,
  })
}

async function getUsersQuota(_request: NextRequest, context: AdminAuthContext) {
  return buildUsersQuotaResponse(context)
}

async function enforceUsersQuota(_request: NextRequest, context: AdminAuthContext) {
  if (!context.organizationId) {
    return buildUsersQuotaResponse(context)
  }

  const quota = await canCreateResource(context.organizationId, 'users')
  const shouldEnforce = !quota.blocked && quota.limit !== null && quota.current > quota.limit
  const enforcedSuspensions = shouldEnforce
    ? await enforceActiveUserLimit(context.organizationId, quota.limit!, context.user.id)
    : 0

  return buildUsersQuotaResponse(context, enforcedSuspensions)
}

export const GET = withAdminAuth(getUsersQuota)
export const POST = withAdminAuth(enforceUsersQuota)
