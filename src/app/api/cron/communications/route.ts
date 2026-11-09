import { dispatchPublishedSystemNews } from '@/lib/mobile/system-news-worker'
import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

/** Worker independiente. Requiere scheduler y CRON_SECRET; no se ejecuta al abrir Superadmin. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return NextResponse.json({error:'El proceso programado no está configurado.'},{status:503})
  if (request.headers.get('authorization') !== 'Bearer '+secret) return NextResponse.json({error:'No autorizado.'},{status:401})
  try {
    const {data,error} = await createAdminSupabase().rpc('dispatch_due_global_notifications')
    if (error) return NextResponse.json({error:'No se pudieron publicar los avisos programados.'},{status:500})
    await dispatchPublishedSystemNews()
    return NextResponse.json({published:data ?? 0})
  } catch {
    return NextResponse.json({error:'No se pudo ejecutar la publicación programada.'},{status:500})
  }
}
