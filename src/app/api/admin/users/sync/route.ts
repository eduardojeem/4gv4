import { NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { logger } from '@/lib/logger'
import { createAdminSupabase, mapUiRoleToDbRole } from '@/lib/supabase/admin'

type CanonicalRole = 'super_admin' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'
type ProfileStatus = 'active' | 'inactive' | 'suspended'
type NonPrivilegedRole = 'vendedor' | 'tecnico' | 'cliente'

const ACTIVE_STATUS: ProfileStatus = 'active'
const SUSPENDED_STATUS: ProfileStatus = 'suspended'

function toCanonicalRole(value: unknown): CanonicalRole | null {
  if (typeof value !== 'string') return null
  const mapped = mapUiRoleToDbRole(value)
  if (!mapped) return null
  return mapped as CanonicalRole
}

function toNonPrivilegedRole(value: unknown): NonPrivilegedRole | null {
  const canonical = toCanonicalRole(value)
  if (canonical === 'vendedor' || canonical === 'tecnico' || canonical === 'cliente') {
    return canonical
  }
  return null
}

function normalizeStatus(value: unknown): ProfileStatus {
  if (value === 'active' || value === 'inactive' || value === 'suspended') {
    return value
  }
  return ACTIVE_STATUS
}

function isUserBanned(user: { banned_until?: string | null }): boolean {
  if (!user?.banned_until) return false
  const until = new Date(user.banned_until).getTime()
  if (!Number.isFinite(until)) return false
  return until > Date.now()
}

async function handler(_request: Request, context: { user: { id: string; email?: string; role: string } }) {
  try {
    logger.info('Starting user sync', { syncedBy: context.user.id })

    const supabaseAdmin = createAdminSupabase()

    // Obtener todos los usuarios de auth.users con paginacion para no truncar resultados.
    const users: Array<{
      id: string
      email?: string | null
      user_metadata?: Record<string, unknown> | null
      banned_until?: string | null
    }> = []

    let page = 1
    const perPage = 1000

    while (true) {
      const { data, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (usersError) {
        throw usersError
      }

      const batch = data?.users || []
      users.push(...batch)

      if (batch.length < perPage) {
        break
      }
      page += 1
    }

    const results = {
      total: users.length,
      updated: 0,
      errors: [] as string[],
    }

    // Sincronizar cada usuario con profiles y user_roles.
    // Seguridad: no usar metadata.role como fuente de verdad para privilegios.
    for (const user of users) {
      try {
        const metadata = user.user_metadata || {}
        const fullName =
          (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
          user.email?.split('@')[0] ||
          'Usuario'

        const [{ data: existingRoleRow }, { data: existingProfileRow }] = await Promise.all([
          supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabaseAdmin
            .from('profiles')
            .select('role,status')
            .eq('id', user.id)
            .maybeSingle(),
        ])

        // Only user_roles can preserve privileged roles. Profile fallback is restricted to non-privileged roles.
        const canonicalRole =
          toCanonicalRole(existingRoleRow?.role) ??
          toNonPrivilegedRole(existingProfileRow?.role) ??
          'cliente'

        let status = normalizeStatus(existingProfileRow?.status)
        if (isUserBanned(user)) {
          status = SUSPENDED_STATUS
        }

        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert(
            {
              id: user.id,
              email: user.email,
              full_name: fullName,
              role: canonicalRole,
              status,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )

        if (profileError) throw profileError

        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .upsert(
            {
              user_id: user.id,
              role: canonicalRole,
              is_active: status === ACTIVE_STATUS,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )

        if (roleError) throw roleError

        results.updated++
      } catch (err: any) {
        logger.error('Error syncing user', {
          userId: user.id,
          email: user.email,
          error: err?.message,
        })
        results.errors.push(`User ${user.email}: ${err?.message || 'Unknown error'}`)
      }
    }

    const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
      user_id: context.user.id,
      action: 'user_sync',
      resource: 'users',
      resource_id: 'bulk',
      new_values: {
        total: results.total,
        updated: results.updated,
        errors: results.errors.length,
      },
    })

    if (auditError) {
      logger.error('Failed to log user sync', { error: auditError })
    }

    logger.info('User sync completed', {
      syncedBy: context.user.id,
      total: results.total,
      updated: results.updated,
      errors: results.errors.length,
      pagesProcessed: page,
    })

    return NextResponse.json({
      success: true,
      message: `Sincronizacion completada. ${results.updated}/${results.total} usuarios procesados.`,
      details: results,
    })
  } catch (error: any) {
    logger.error('Sync error', { error: error?.message || String(error) })
    return NextResponse.json(
      { success: false, error: error?.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}

export const POST = withAdminAuth(handler)
