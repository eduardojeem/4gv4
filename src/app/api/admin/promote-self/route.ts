import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function POST() {
  if (process.env.ALLOW_ADMIN_SELF_PROMOTION !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: promoted, error } = await supabase.rpc('bootstrap_first_admin')
    if (error) {
      logger.error('Atomic first-admin bootstrap failed', {
        error: error.message,
        userId: user.id,
      })
      return NextResponse.json({ error: 'Could not complete admin bootstrap' }, { status: 500 })
    }

    if (!promoted) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Administrators already exist. Contact an existing administrator.',
        },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully promoted to first administrator',
    })
  } catch (error) {
    logger.error('Self-promotion error', { error })
    return NextResponse.json({ error: 'Could not complete admin bootstrap' }, { status: 500 })
  }
}
