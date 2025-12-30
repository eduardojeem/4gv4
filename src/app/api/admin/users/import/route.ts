import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase, mapUiRoleToDbRole } from '@/lib/supabase/admin'

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const users: ImportUser[] = Array.isArray(body?.users) ? body.users : []
    if (!users.length) {
      return NextResponse.json({ ok: false, error: 'No users provided' }, { status: 400 })
    }

    const results: { email: string; ok: boolean; error?: string }[] = []
    
    // Try admin client first (requires SUPABASE_SERVICE_ROLE_KEY). Fallback to anon signUp.
    let adminClient: ReturnType<typeof createAdminSupabase> | null = null
    try {
      adminClient = createAdminSupabase()
    } catch {
      adminClient = null
    }

    if (adminClient) {
      // Preload existing users to speed up updates (single page)
      const existingMap = new Map<string, string>()
      try {
        const { data: list } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
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
            const { error: updateErr } = await adminClient.auth.admin.updateUserById(existingId, {
              user_metadata: {
                full_name: u.name,
                role: u.role ?? null,
                status: u.status ?? null,
                imported_via: 'admin_csv',
              },
            })
            if (updateErr) throw updateErr

            if (dbRole) {
              await adminClient.from('user_roles').upsert(
                { user_id: existingId, role: dbRole },
                { onConflict: 'user_id' }
              )
            }

            await adminClient.from('profiles').upsert({ id: existingId, name: u.name, email: u.email })
            results.push({ email: u.email, ok: true })
            continue
          }

          const password = genPassword()
          const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
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
              await adminClient.from('user_roles').upsert(
                { user_id: userId, role: dbRole },
                { onConflict: 'user_id' }
              )
            }
            await adminClient.from('profiles').upsert({ id: userId, name: u.name, email: u.email })
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
    return NextResponse.json({ ok: true, imported: okCount, failed: errorCount, results })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}