import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { createClient } from '@/lib/supabase/server'
import {
  SystemSettingsPartialSchema,
  mapSettingsToDB
} from '@/lib/validations/system-settings'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_LIMIT_WINDOW = 60 * 1000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (entry.count >= RATE_LIMIT) {
    return false
  }

  entry.count += 1
  rateLimitMap.set(userId, entry)
  return true
}

async function handler(
  request: NextRequest,
  context: { user: { id: string; email?: string; role: string } }
) {
  try {
    if (!checkRateLimit(context.user.id)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validation = SystemSettingsPartialSchema.safeParse(body?.settings)

    if (!validation.success) {
      const firstIssue = validation.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstIssue?.message || 'Invalid settings payload' },
        { status: 400 }
      )
    }

    const dbData = mapSettingsToDB(validation.data)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('system_settings')
      .upsert(
        {
          id: 'system',
          ...dbData,
          updated_by: context.user.id,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single()

    if (error) {
      const msg = typeof error.message === 'string' ? error.message : 'Update failed'
      const isRls = /row-level security|RLS/i.test(msg)
      return NextResponse.json(
        { success: false, error: isRls ? 'Forbidden by RLS' : 'Failed to update system settings' },
        { status: isRls ? 403 : 500 }
      )
    }

    try {
      await supabase.from('audit_log').insert({
        user_id: context.user.id,
        action: 'update_system_settings',
        resource: 'system_settings',
        resource_id: 'system',
        new_values: validation.data
      })
    } catch (auditError) {
      console.error('Failed to write audit log for system settings update:', auditError)
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('System settings API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update system settings' },
      { status: 500 }
    )
  }
}

export const PUT = withAdminAuth(handler)
