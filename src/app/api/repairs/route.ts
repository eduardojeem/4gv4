import { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

// GET /api/repairs -> Lista reparaciones desde Supabase si está configurado, si no, datos demo
export async function GET(_req: NextRequest) {
  try {
    const isConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!isConfigured) {
      const demo = [
        { id: 'K-001', customerName: 'Juan', deviceModel: 'iPhone 14 Pro', issueDescription: 'Pantalla rota', createdAt: new Date().toISOString(), urgency: 5, technicalComplexity: 3, stage: 'received', historicalValue: 1200 },
        { id: 'K-002', customerName: 'Ana', deviceModel: 'Galaxy S22', issueDescription: 'Batería no carga', createdAt: new Date().toISOString(), urgency: 3, technicalComplexity: 2, stage: 'in_repair', historicalValue: 800 },
        { id: 'K-003', customerName: 'Luis', deviceModel: 'MacBook Pro 13"', issueDescription: 'Teclado no responde', createdAt: new Date().toISOString(), urgency: 4, technicalComplexity: 4, stage: 'awaiting_parts', historicalValue: 2000 },
      ]
      return new Response(JSON.stringify({ repairs: demo }), { status: 200, headers: { 'content-type': 'application/json' } })
    }

    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from('repairs')
      .select('id,customer_name,device_model,issue_description,urgency,technical_complexity,historical_value,stage,created_at,updated_at')
      .limit(200)

    if (error) throw error

    const repairs = (data || []).map((r: any) => ({
      id: String(r.id),
      customerName: r.customer_name,
      deviceModel: r.device_model,
      issueDescription: r.issue_description,
      urgency: r.urgency ?? 3,
      technicalComplexity: r.technical_complexity ?? 3,
      historicalValue: r.historical_value ?? 0,
      stage: r.stage || 'received',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))

    return new Response(JSON.stringify({ repairs }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500 })
  }
}