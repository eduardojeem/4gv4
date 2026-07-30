import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth } from '@/lib/api/withAdminAuth'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

const actionSchema = z.object({
  sessionId: z.string().uuid(),
  action: z.enum(['remote_close', 'suspend', 'unsuspend', 'block', 'unblock', 'reopen']),
  reason: z.string().trim().max(500).optional(),
})

export const POST = withAdminAuth(async (request: NextRequest) => {
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Acción de caja inválida' },
      { status: 400 }
    )
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.rpc('perform_cash_admin_action', {
    p_session_id: parsed.data.sessionId,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason ?? null,
    p_user_agent: request.headers.get('user-agent'),
  })

  if (error) {
    const forbidden = error.message.includes('permissions')
    return NextResponse.json(
      {
        success: false,
        error: forbidden
          ? 'No tenés permisos para administrar esta caja'
          : 'No se pudo ejecutar la acción de caja',
      },
      { status: forbidden ? 403 : 500 }
    )
  }

  return NextResponse.json({ success: true, data })
})
