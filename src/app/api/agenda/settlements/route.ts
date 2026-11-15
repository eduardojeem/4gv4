import { NextResponse } from 'next/server'
import { z } from 'zod'
import { settlementMutationProblem, settlementSessionProblem } from '@/lib/agenda/settlement-security'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
const guard = { permission: 'pos.cash.manage', module: 'services' } as const
const allowed = (role: string) => ['owner', 'admin'].includes(role)
const forbidden = () => NextResponse.json({ error: 'Solo un administrador puede gestionar liquidaciones.' }, { status: 403 })
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value)
const settlementSchema = z.object({
  professionalId: z.string().uuid(), receiptCode: z.string().min(3).max(100),
  periodPreset: z.enum(['today','this_week','last_week','this_month','custom']).default('this_week'),
  periodFrom: date, periodTo: date, tipsAmount: z.number().finite().min(0).max(1e10).default(0),
  advancesValesAmount: z.number().finite().min(0).max(1e10).default(0), netAmount: z.number().finite().positive().max(1e10),
  paymentMethod: z.enum(['cash','transfer','qr']), paymentReference: z.string().max(200).nullable().optional(), notes: z.string().max(1000).nullable().optional(),
})
  .refine(value => value.periodTo >= value.periodFrom && Date.parse(value.periodTo)-Date.parse(value.periodFrom) <= 30*86400000)
  .refine(value => value.paymentMethod === 'cash' || Boolean(value.paymentReference && value.paymentReference.trim().length > 0))
function failure(error: { code?: string; message?: string }) {
  const missing = ['PGRST202','42883','42P01','42703'].includes(error.code ?? '')
  const messages: Record<string,string> = {
    ACTOR_NOT_AUTHORIZED: 'Solo un administrador puede gestionar liquidaciones.',
    SETTLEMENT_CHANGED: 'Cambió el saldo del período. Recargá y revisá la liquidación antes de pagar.',
    SETTLEMENT_PERIOD_OVERLAP: 'Hay pagos con un período distinto que se superpone. Usá el mismo período del recibo original.',
    SETTLEMENT_CASH_SESSION_REQUIRED: 'Para pagar en efectivo debe haber una única caja abierta en el negocio.',
    OPEN_CASH_SESSION_NOT_FOUND: 'La caja del pago está cerrada. La operación no se realizó; revisá la caja antes de continuar.',
    PROFESSIONAL_NOT_FOUND: 'El profesional no pertenece al negocio.',
    SETTLEMENT_NOT_FOUND: 'No se encontró la liquidación.',
    IDEMPOTENCY_CONFLICT: 'Este intento ya se registró con otros datos. Recargá el historial.',
  }
  const key=Object.keys(messages).find(code=>error.message?.includes(code))
  return NextResponse.json({ error: missing ? 'Falta aplicar la actualización de liquidaciones de Agenda.' : key ? messages[key] : 'No se pudo registrar la operación. No se guardaron cambios.', code: missing ? 'MIGRATION_REQUIRED' : key ?? 'SETTLEMENT_FAILED' }, { status: missing ? 503 : 409 })
}
const SETTLEMENT_COLUMNS = 'id,professional_id,professional_name,receipt_code,period_preset,period_from,period_to,appointments_count,total_billed,commission_rate,commission_amount,deductions_amount,advances_vales_amount,tips_amount,net_amount,remuneration_type,payment_method,payment_reference,cash_movement_id,settled_at,status,cancellation_reason,cancelled_by,cancelled_at'
export const GET = withTenantAuth(guard, async (request, { organization, user }) => {
  if (!allowed(organization.role)) return forbidden()
  const sessionProblem = await settlementSessionProblem(organization.id, user.aal)
  if (sessionProblem) return sessionProblem
  const params = new URL(request.url).searchParams
  const professionalId = params.get('professionalId')
  const from = params.get('from')
  const to = params.get('to')
  const status = params.get('status')
  if (professionalId && !z.string().uuid().safeParse(professionalId).success) return NextResponse.json({ error: 'Profesional inválido.' }, { status: 422 })
  if (from && !date.safeParse(from).success) return NextResponse.json({ error: 'Fecha de inicio inválida.' }, { status: 422 })
  if (to && !date.safeParse(to).success) return NextResponse.json({ error: 'Fecha de fin inválida.' }, { status: 422 })
  if (status && status !== 'paid' && status !== 'cancelled') return NextResponse.json({ error: 'Estado inválido.' }, { status: 422 })
  const offset = Math.max(0, Math.floor(Number(params.get('offset')) || 0))
  const limit = Math.min(200, Math.max(1, Math.floor(Number(params.get('limit')) || 50)))
  let query = createAdminSupabase()
    .from('agenda_professional_settlements')
    .select(SETTLEMENT_COLUMNS)
    .eq('organization_id', organization.id)
    .order('settled_at', { ascending: false })
    .range(offset, offset + limit)
  if (professionalId) query = query.eq('professional_id', professionalId)
  if (status) query = query.eq('status', status)
  // Un recibo cuenta si su período se superpone con el rango indicado. Cada extremo es opcional.
  if (to) query = query.lte('period_from', to)
  if (from) query = query.gte('period_to', from)
  const { data, error } = await query
  if (error) return failure(error)
  const rows = data ?? []
  const hasMore = rows.length > limit
  // Contexto opcional: caja(s) abierta(s) para mostrar de dónde saldrá el efectivo.
  let cashSession: { count: number; registerName: string | null } | null = null
  if (params.get('context') === '1') {
    const admin = createAdminSupabase()
    const { data: sessions } = await admin.from('cash_closures').select('id, register_id').eq('organization_id', organization.id).is('date', null).limit(5)
    const registerIds = Array.from(new Set((sessions ?? []).map(row => row.register_id).filter((value): value is string => Boolean(value))))
    const { data: registers } = registerIds.length
      ? await admin.from('cash_registers').select('id, name, is_active').eq('organization_id', organization.id).in('id', registerIds)
      : { data: [] as { id: string; name: string; is_active: boolean | null }[] }
    const activeIds = new Set((registers ?? []).filter(register => register.is_active !== false).map(register => register.id))
    const open = (sessions ?? []).filter(row => activeIds.has(row.register_id))
    cashSession = { count: open.length, registerName: (registers ?? []).find(register => register.id === open[0]?.register_id)?.name ?? null }
  }
  return NextResponse.json({ success: true, settlements: hasMore ? rows.slice(0, limit) : rows, hasMore, offset, migrationPending: false, cashSession }, { headers: { 'Cache-Control': 'no-store' } })
})
export const POST = withTenantAuth(guard, async (request, { organization, user }) => {
  if (!allowed(organization.role)) return forbidden()
  const sessionProblem = await settlementSessionProblem(organization.id, user.aal)
  if (sessionProblem) return sessionProblem
  const mutationProblem = settlementMutationProblem(request)
  if (mutationProblem) return mutationProblem
  const parsed=settlementSchema.safeParse(await request.json().catch(()=>null))
  if (!parsed.success) return NextResponse.json({error:'Revisá el período y los importes de la liquidación.'},{status:422})
  const {data,error}=await createAdminSupabase().rpc('save_agenda_settlement_checked',{p_org:organization.id,p_actor:user.id,p_input:parsed.data})
  if(error || !data) return failure(error ?? {})
  return NextResponse.json({success:true,settlement:data,cashMovementCreated:Boolean(data.cash_movement_id)})
})
export const PATCH = withTenantAuth(guard, async (request, { organization, user }) => {
  if (!allowed(organization.role)) return forbidden()
  const sessionProblem = await settlementSessionProblem(organization.id, user.aal)
  if (sessionProblem) return sessionProblem
  const mutationProblem = settlementMutationProblem(request)
  if (mutationProblem) return mutationProblem
  const parsed=z.object({settlementId:z.string().uuid(),action:z.literal('cancel'),reason:z.string().trim().min(5).max(300)}).safeParse(await request.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:'Liquidación inválida.'},{status:400})
  const {data,error}=await createAdminSupabase().rpc('cancel_agenda_settlement_checked',{p_org:organization.id,p_actor:user.id,p_id:parsed.data.settlementId,p_reason:parsed.data.reason})
  if(error || !data)return failure(error ?? {})
  return NextResponse.json({success:true,settlement:data})
})
