import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getClientIp, rateLimiter } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

/** El cliente cancela su turno desde el enlace que recibió. Solo antes de que empiece. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!z.string().uuid().safeParse(token).success) return NextResponse.json({ error: 'Enlace inválido' }, { status: 400 })
  if (!(await rateLimiter.check(`appointment-cancel:${getClientIp(request)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: 'Probá en unos minutos' }, { status: 429 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('appointments')
    .update({ status: 'cancelled', cancel_reason: 'Cancelado por el cliente' })
    .eq('public_token', token)
    .in('status', ['pending', 'confirmed'])
    .gt('starts_at', new Date().toISOString())
    .select('id')
  if (error) return NextResponse.json({ error: 'No se pudo cancelar' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Este turno ya no se puede cancelar desde acá. Escribile a la tienda.' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
