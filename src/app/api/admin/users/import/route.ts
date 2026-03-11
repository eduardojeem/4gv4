import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase, mapUiRoleToDbRole } from '@/lib/supabase/admin'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { logger } from '@/lib/logger'

type ImportUser = {
  name: string
  email: string
  role?: string
  status?: string
}

type CanonicalRole = 'super_admin' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'
type ProfileStatus = 'active' | 'inactive' | 'suspended'

const MAX_IMPORT_SIZE = 100
const DEFAULT_ROLE: CanonicalRole = 'cliente'
const DEFAULT_STATUS: ProfileStatus = 'active'

function genPassword(len = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+'
  let pass = ''
  for (let i = 0; i < len; i++) pass += chars[Math.floor(Math.random() * chars.length)]
  return pass
}

function normalizeRole(role?: string): CanonicalRole {
  const mapped = mapUiRoleToDbRole(role) as CanonicalRole | undefined
  return mapped ?? DEFAULT_ROLE
}

function normalizeStatus(value?: string): ProfileStatus {
  if (value === 'active' || value === 'inactive' || value === 'suspended') {
    return value
  }
  return DEFAULT_STATUS
}

async function loadExistingUsersByEmail(supabaseAdmin: ReturnType<typeof createAdminSupabase>) {
  const existingMap = new Map<string, string>()
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const batch = data?.users ?? []
    for (const existing of batch) {
      const email = existing.email?.toLowerCase()
      if (email) {
        existingMap.set(email, existing.id)
      }
    }

    if (batch.length < perPage) break
    page += 1
  }

  return existingMap
}

async function handler(req: NextRequest, context: { user: { id: string; email?: string; role: string } }) {
  try {
    const body = await req.json()
    const users: ImportUser[] = Array.isArray(body?.users) ? body.users : []

    if (!users.length) {
      return NextResponse.json({ ok: false, error: 'No users provided' }, { status: 400 })
    }

    if (users.length > MAX_IMPORT_SIZE) {
      return NextResponse.json(
        { ok: false, error: `Maximum ${MAX_IMPORT_SIZE} users per import` },
        { status: 400 }
      )
    }

    const hasSuperAdminAttempt = users.some((u) => normalizeRole(u.role) === 'super_admin')
    if (hasSuperAdminAttempt && context.user.role !== 'super_admin') {
      logger.warn('Unauthorized super_admin creation attempt', {
        userId: context.user.id,
        userRole: context.user.role,
      })

      return NextResponse.json(
        {
          ok: false,
          error: 'Only super administrators can create super_admin users',
        },
        { status: 403 }
      )
    }

    const normalizedUsers = users.map((u) => ({
      email: u.email?.toLowerCase().trim(),
      name: u.name?.trim(),
      role: normalizeRole(u.role),
      status: normalizeStatus(u.status),
    }))

    const invalid = normalizedUsers.find((u) => !u.email || !u.name)
    if (invalid) {
      return NextResponse.json(
        { ok: false, error: 'Each imported user requires a valid name and email' },
        { status: 400 }
      )
    }

    logger.info('Starting user import', {
      importedBy: context.user.id,
      userCount: users.length,
    })

    const results: { email: string; ok: boolean; error?: string }[] = []

    let supabaseAdmin: ReturnType<typeof createAdminSupabase> | null = null
    try {
      supabaseAdmin = createAdminSupabase()
    } catch (err) {
      logger.warn('Service role client not available for user import, using fallback mode', {
        error: err instanceof Error ? err.message : String(err),
      })
      supabaseAdmin = null
    }

    if (supabaseAdmin) {
      const existingMap = await loadExistingUsersByEmail(supabaseAdmin)

      for (const u of normalizedUsers) {
        const email = u.email as string
        const fullName = u.name as string
        const role = u.role
        const status = u.status

        try {
          const existingId = existingMap.get(email)

          if (existingId) {
            const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
              user_metadata: {
                full_name: fullName,
                status,
                imported_via: 'admin_csv',
              },
            })
            if (updateUserError) throw updateUserError

            const nowIso = new Date().toISOString()
            const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
              {
                id: existingId,
                full_name: fullName,
                email,
                role,
                status,
                updated_at: nowIso,
              },
              { onConflict: 'id' }
            )
            if (profileError) throw profileError

            const { error: roleError } = await supabaseAdmin.from('user_roles').upsert(
              {
                user_id: existingId,
                role,
                is_active: status === 'active',
                updated_at: nowIso,
              },
              { onConflict: 'user_id' }
            )
            if (roleError) throw roleError

            results.push({ email, ok: true })
            continue
          }

          const password = genPassword()
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: false,
            app_metadata: { role },
            user_metadata: {
              full_name: fullName,
              status,
              imported_via: 'admin_csv',
            },
          })
          if (createErr) throw createErr

          const userId = created?.user?.id
          if (userId) {
            const nowIso = new Date().toISOString()
            const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
              {
                id: userId,
                full_name: fullName,
                email,
                role,
                status,
                updated_at: nowIso,
              },
              { onConflict: 'id' }
            )
            if (profileError) throw profileError

            const { error: roleError } = await supabaseAdmin.from('user_roles').upsert(
              {
                user_id: userId,
                role,
                is_active: status === 'active',
                updated_at: nowIso,
              },
              { onConflict: 'user_id' }
            )
            if (roleError) throw roleError

            existingMap.set(email, userId)
          }

          results.push({ email, ok: true })
        } catch (e: any) {
          results.push({ email, ok: false, error: e?.message || 'Unknown error' })
        }
      }
    } else {
      const supabase = await createServerSupabase()

      for (const u of normalizedUsers) {
        const email = u.email as string
        const fullName = u.name as string
        const role = u.role
        const status = u.status
        const password = genPassword()

        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                status,
                imported_via: 'admin_csv',
              },
            },
          })
          if (error) throw error

          const userId = data?.user?.id
          if (userId) {
            const nowIso = new Date().toISOString()
            await supabase.from('profiles').upsert(
              {
                id: userId,
                full_name: fullName,
                email,
                role,
                status,
                updated_at: nowIso,
              },
              { onConflict: 'id' }
            )

            await supabase.from('user_roles').upsert(
              {
                user_id: userId,
                role,
                is_active: status === 'active',
                updated_at: nowIso,
              },
              { onConflict: 'user_id' }
            )
          }

          results.push({ email, ok: true })
        } catch (e: any) {
          results.push({ email, ok: false, error: e?.message || 'Unknown error' })
        }
      }
    }

    const okCount = results.filter((r) => r.ok).length
    const errorCount = results.length - okCount

    if (supabaseAdmin) {
      const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
        user_id: context.user.id,
        action: 'bulk_user_import',
        resource: 'users',
        resource_id: 'bulk',
        new_values: {
          total: users.length,
          imported: okCount,
          failed: errorCount,
          roles: normalizedUsers.map((u) => u.role),
        },
      })

      if (auditError) {
        logger.error('Failed to log user import', { error: auditError })
      }
    }

    logger.info('User import completed', {
      importedBy: context.user.id,
      total: users.length,
      imported: okCount,
      failed: errorCount,
    })

    return NextResponse.json({ ok: true, imported: okCount, failed: errorCount, results })
  } catch (e: any) {
    logger.error('User import error', { error: e?.message })
    return NextResponse.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export const POST = withAdminAuth(handler)
