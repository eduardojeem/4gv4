import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

type AllowedStatus = 'active' | 'inactive' | 'suspended'

function isAllowedStatus(value: unknown): value is AllowedStatus {
  return value === 'active' || value === 'inactive' || value === 'suspended'
}

async function handler(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>
    user: { id: string; email?: string; role: string }
    organizationId: string | null
  }
) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const nextStatus = body?.status

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing user id' },
        { status: 400 }
      )
    }

    if (!isAllowedStatus(nextStatus)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    if (context.user.id === id && nextStatus !== 'active') {
      return NextResponse.json(
        { success: false, error: 'You cannot deactivate your own account from this endpoint' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminSupabase()

    // For non-super_admin: verify the target user belongs to the same organization
    if (context.organizationId) {
      const { data: targetMembership } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', id)
        .eq('organization_id', context.organizationId)
        .maybeSingle()

      if (!targetMembership) {
        return NextResponse.json(
          { success: false, error: 'User not found in your organization' },
          { status: 403 }
        )
      }
    }
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', id)
      .maybeSingle()

    if (roleError) {
      logger.error('Failed to read target user role for status update', {
        userId: id,
        error: roleError.message,
      })

      return NextResponse.json(
        { success: false, error: 'Failed to load target user role' },
        { status: 500 }
      )
    }

    const targetRole = roleRow?.role
    const deactivatingUser = nextStatus !== 'active'

    if (deactivatingUser && targetRole === 'super_admin' && context.user.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Only super administrators can suspend a super_admin account' },
        { status: 403 }
      )
    }

    if (deactivatingUser && (targetRole === 'admin' || targetRole === 'super_admin')) {
      const activeAdminQuery = context.organizationId
        ? supabaseAdmin
            .from('organization_members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', context.organizationId)
            .in('role', ['owner', 'admin'])
            .eq('status', 'active')
        : supabaseAdmin
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .in('role', ['admin', 'super_admin'])
            .eq('is_active', true)

      const { count: activeAdminCount, error: activeAdminError } = await activeAdminQuery

      if (activeAdminError) {
        logger.error('Failed to count active administrators', {
          error: activeAdminError.message,
        })

        return NextResponse.json(
          { success: false, error: 'Failed to validate active administrators' },
          { status: 500 }
        )
      }

      if ((activeAdminCount ?? 0) <= 1) {
        return NextResponse.json(
          { success: false, error: 'At least one active administrator must remain' },
          { status: 400 }
        )
      }
    }

    const nowIso = new Date().toISOString()
    const updateOperations = [
      supabaseAdmin
        .from('profiles')
        .update({
          status: nextStatus,
          updated_at: nowIso,
        })
        .eq('id', id),
      supabaseAdmin
        .from('user_roles')
        .update({
          is_active: nextStatus === 'active',
          updated_at: nowIso,
        })
        .eq('user_id', id),
      supabaseAdmin.from('audit_log').insert({
        user_id: context.user.id,
        action: 'update_user_status',
        resource: 'users',
        resource_id: id,
        new_values: {
          status: nextStatus,
          updated_by: context.user.id,
          organization_id: context.organizationId,
        },
      }),
    ]

    if (context.organizationId) {
      updateOperations.push(
        supabaseAdmin
          .from('organization_members')
          .update({ status: nextStatus === 'active' ? 'active' : 'inactive' })
          .eq('organization_id', context.organizationId)
          .eq('user_id', id)
      )
    }

    const [{ error: profileUpdateError }, { error: roleUpdateError }, { error: auditError }, memberResult] =
      await Promise.all([
        ...updateOperations,
      ])

    if (profileUpdateError) {
      logger.error('Failed to update profile status', {
        userId: id,
        error: profileUpdateError.message,
      })

      return NextResponse.json(
        { success: false, error: 'Failed to update profile status' },
        { status: 500 }
      )
    }

    if (roleUpdateError) {
      logger.error('Failed to update user_roles active status', {
        userId: id,
        error: roleUpdateError.message,
      })

      return NextResponse.json(
        { success: false, error: 'Failed to update role status' },
        { status: 500 }
      )
    }

    if (auditError) {
      logger.error('Failed to audit user status update', {
        userId: id,
        error: auditError.message,
      })
    }

    if (memberResult?.error) {
      logger.error('Failed to update organization member status', {
        userId: id,
        organizationId: context.organizationId,
        error: memberResult.error.message,
      })

      return NextResponse.json(
        { success: false, error: 'Failed to update organization member status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
    })
  } catch (error) {
    logger.error('User status update API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to update user status' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth((req, authContext) =>
    handler(req, { params: context.params, user: authContext.user, organizationId: authContext.organizationId })
  )(request)
}
