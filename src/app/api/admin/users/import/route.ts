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

function genPassword(len = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  let pass = ''
  for (let i = 0; i < len; i++) pass += chars[Math.floor(Math.random() * chars.length)]
  return pass
}

async function handler(req: NextRequest, context: { user: { id: string; email?: string; role: string } }) {
  try {
    const body = await req.json()
    const users: ImportUser[] = Array.isArray(body?.users) ? body.users : []
    
    if (!users.length) {
      return NextResponse.json({ ok: false, error: 'No users provided' }, { status: 400 })
    }

    // SEGURIDAD: Validar que no se intente crear super_admin si el usuario no lo es
    const hasSuperAdminAttempt = users.some(u => 
      u.role === 'super_admin' || mapUiRoleToDbRole(u.role) === 'super_admin'
    )
    
    if (hasSuperAdminAttempt && context.user.role !== 'super_admin') {
      logger.warn('Unauthorized super_admin creation attempt', {
        userId: context.user.id,
        userRole: context.user.role
      })
      
      return NextResponse.json({ 
        ok: false, 
        error: 'Only super administrators can create super_admin users' 
      }, { status: 403 })
    }

    // SEGURIDAD: Limitar cantidad de usuarios por importación
    const MAX_IMPORT_SIZE = 100
    if (users.length > MAX_IMPORT_SIZE) {
      return NextResponse.json({ 
        ok: false, 
        error: `Maximum ${MAX_IMPORT_SIZE} users per import` 
      }, { status: 400 })
    }

    logger.info('Starting user import', {
      importedBy: context.user.id,
      userCount: users.length
    })

    const results: { email: string; ok: boolean; error?: string }[] = []
    
    // Try admin client first (requires SUPABASE_SERVICE_ROLE_KEY). Fallback to anon signUp.
    let supabaseAdmin: ReturnType<typeof createAdminSupabase> | null = null
    try {
      supabaseAdmin = createAdminSupabase()
    } catch {
      supabaseAdmin = null
    }

    if (supabaseAdmin) {
      // Preload existing users to speed up updates (single page)
      const existingMap = new Map<string, string>()
      try {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        for (const user of list?.users ?? []) {
          const email = user.email?.toLowerCase()
          if (email) existingMap.set(email, user.id)
        }
      } catch {}

      for (const u of users) {
        const email = u.email.toLowerCase()
        const dbRole = mapUiRoleToDbRole(u.role)
        try {
          const existingId = existingMap.get(email)
          if (existingId) {
            const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
              user_metadata: {
                full_name: u.name,
                role: u.role ?? null,
                status: u.status ?? null,
                imported_via: 'admin_csv',
              },
            })
            if (updateErr) throw updateErr

            if (dbRole) {
              await supabaseAdmin.from('user_roles').upsert(
                { user_id: existingId, role: dbRole },
                { onConflict: 'user_id' }
              )
            }

            await supabaseAdmin.from('profiles').upsert({ id: existingId, name: u.name, email: u.email })
            results.push({ email: u.email, ok: true })
            continue
          }

          const password = genPassword()
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password,
            email_confirm: false,
            user_metadata: {
              full_name: u.name,
              role: u.role ?? null,
              status: u.status ?? null,
              imported_via: 'admin_csv',
            },
          })
          if (createErr) throw createErr

          const userId = created?.user?.id
          if (userId) {
            if (dbRole) {
              await supabaseAdmin.from('user_roles').upsert(
                { user_id: userId, role: dbRole },
                { onConflict: 'user_id' }
              )
            }
            await supabaseAdmin.from('profiles').upsert({ id: userId, name: u.name, email: u.email })
          }

          results.push({ email: u.email, ok: true })
        } catch (e: any) {
          results.push({ email: u.email, ok: false, error: e?.message || 'Unknown error' })
        }
      }
    } else {
      const supabase = await createServerSupabase()
      for (const u of users) {
        const password = genPassword()
        try {
          const { data, error } = await supabase.auth.signUp({
            email: u.email,
            password,
            options: {
              data: {
                full_name: u.name,
                role: u.role,
                status: u.status,
                imported_via: 'admin_csv',
              },
            },
          })
          if (error) throw error
          const userId = (data as any)?.user?.id
          if (userId) {
            try {
              await supabase.from('profiles').upsert({ id: userId, name: u.name })
            } catch {}
          }
          results.push({ email: u.email, ok: true })
        } catch (e: any) {
          results.push({ email: u.email, ok: false, error: e?.message || 'Unknown error' })
        }
      }
    }

    const okCount = results.filter(r => r.ok).length
    const errorCount = results.length - okCount

    // Registrar importación en audit_log
    const auditClient = createAdminSupabase()
    try {
      await auditClient.from('audit_log').insert({
        user_id: context.user.id,
        action: 'bulk_user_import',
        resource: 'users',
        resource_id: 'bulk',
        new_values: {
          total: users.length,
          imported: okCount,
          failed: errorCount,
          roles: users.map(u => u.role).filter(Boolean)
        }
      })
    } catch (err) {
      logger.error('Failed to log user import', { error: err })
    }

    logger.info('User import completed', {
      importedBy: context.user.id,
      total: users.length,
      imported: okCount,
      failed: errorCount
    })

    return NextResponse.json({ ok: true, imported: okCount, failed: errorCount, results })
  } catch (e: any) {
    logger.error('User import error', { error: e?.message })
    return NextResponse.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

export const POST = withAdminAuth(handler)