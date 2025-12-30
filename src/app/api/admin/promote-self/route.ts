import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = createAdminSupabase()

    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: user.id,
        role: 'admin',
        full_name: user.user_metadata?.full_name ?? null,
        updated_at: new Date().toISOString()
      })
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

    const { error: roleError } = await admin
      .from('user_roles')
      .upsert({
        user_id: user.id,
        role: 'admin',
        is_active: true,
        updated_at: new Date().toISOString()
      })
    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 })

    await admin.from('audit_log').insert({
      user_id: user.id,
      action: 'grant_admin_self',
      resource: 'auth',
      resource_id: user.id,
      new_values: { role_ui: 'admin', role_db: 'admin' }
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

