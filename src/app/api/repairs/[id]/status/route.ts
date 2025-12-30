import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

// PATCH /api/repairs/:id/status -> Actualiza stage de la reparación
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { stage } = body as { stage?: string }
    if (!id || !stage) {
      return new Response(JSON.stringify({ error: 'Missing id or stage' }), { status: 400 })
    }

    const isConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!isConfigured) {
      // Demo: confirmar sin persistencia real
      return new Response(JSON.stringify({ ok: true, id, stage }), { status: 200, headers: { 'content-type': 'application/json' } })
    }

    const supabase = createAdminSupabase()
    const { error } = await supabase
      .from('repairs')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500 })
  }
}