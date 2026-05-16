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
  context: { params: Promise<{ id: string }>; user: { id: string; email?: string; role: string } }
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
      const { count: activeAdminCount, error: activeAdminError } = await supabaseAdmin
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .in('role', ['admin', 'super_admin'])
        .eq('is_active', true)

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
    const [{ error: profileUpdateError }, { error: roleUpdateError }, { error: auditError }] =
      await Promise.all([
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
          },
        }),
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
    handler(req, { params: context.params, user: authContext.user })
  )(request)
}
