import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { canAmendCredit, creditAmendmentSchema } from '@/lib/credits/amendment-contract'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'

const errors: Record<string, [number, string]> = {
  AMEND_FORBIDDEN: [403, 'Solo el propietario o administrador de esta organización puede corregir créditos.'],
  AMEND_NOT_FOUND: [404, 'No se encontró el crédito o pago en esta organización.'],
  AMEND_CONFLICT: [409, 'El crédito cambió mientras lo editabas. Recargá los datos antes de guardar.'],
  AMEND_HAS_PAYMENTS: [409, 'Este crédito ya tiene pagos. Reprogramá vencimientos o registrá un ajuste de deuda.'],
  AMEND_CLOSED_CREDIT: [409, 'Solo se puede modificar la deuda de créditos activos o morosos.'],
  AMEND_INSTALLMENT: [409, 'La cuota no pertenece al crédito o ya está pagada.'],
  AMEND_BELOW_PAID: [409, 'El importe de la cuota no puede ser menor a lo que ya se cobró.'],
  AMEND_PAYMENT_DATE: [400, 'La fecha del cobro debe estar entre el inicio del crédito y el momento actual.'],
  AMEND_PAYMENT_UNLINKED: [409, 'No se puede corregir este pago porque no tiene un comprobante y movimiento de caja identificables con certeza.'],
  AMEND_CONSOLIDATED_PAYMENT: [409, 'Este comprobante incluye varias deudas o saldo a favor. Requiere una corrección integral del cobro.'],
  AMEND_CASH_CLOSED: [409, 'La corrección afecta un período cerrado o una caja que no está abierta.'],
  AMEND_INVALID: [400, 'Revisá las fechas, importes y el motivo de la corrección.'],
}
function rpcError(error: { code?: string; message?: string }) {
  if (['PGRST202','42883','42P01'].includes(error.code || '')) return NextResponse.json({ success:false, error:'La edición de créditos requiere actualizar la base de datos.' },{status:503})
  const key = Object.keys(errors).find(code => error.message?.includes(code))
  if (key) return NextResponse.json({success:false,error:errors[key][1],code:key},{status:errors[key][0]})
  if (error.message?.includes('CREDIT_LIMIT') || error.message?.includes('CREDIT_FILE')) return NextResponse.json({success:false,error:'El ajuste supera el cupo disponible o requiere actualizar la aprobación de la ficha de crédito.'},{status:409})
  if (error.code === '22007' || error.code === '22008' || error.code === '23514') return NextResponse.json({success:false,error:'Las fechas o condiciones del crédito no son válidas.'},{status:400})
  return NextResponse.json({success:false,error:'No se pudo confirmar la corrección. Recargá el crédito para verificar el resultado.'},{status:500})
}
const guard = { permission: 'crm.customers.manage', module: 'credits' } as const
export const GET = withTenantAuth(guard,async(request,{organization,user}) => {
  if (!canAmendCredit(organization.role)) return NextResponse.json({success:false,error:errors.AMEND_FORBIDDEN[1]},{status:403})
  const id=z.string().uuid().safeParse(new URL(request.url).searchParams.get('creditId'))
  if (!id.success) return NextResponse.json({success:false,error:'Crédito inválido.'},{status:400})
  const {data,error}=await createAdminSupabase().rpc('get_credit_amendment_state',{
    p_organization_id:organization.id,p_credit_id:id.data,p_actor_id:user.id,
  })
  if (error) return rpcError(error)
  return NextResponse.json({success:true,data},{headers:{'Cache-Control':'private, no-store'}})
})
export const PATCH = withTenantAuth(guard,async(request,{organization,user}) => {
  if (!canAmendCredit(organization.role)) return NextResponse.json({success:false,error:errors.AMEND_FORBIDDEN[1]},{status:403})
  const parsed=creditAmendmentSchema.safeParse(await request.json().catch(()=>null))
  if (!parsed.success) return NextResponse.json({success:false,error:parsed.error.issues[0]?.message || 'Corrección inválida.'},{status:400})
  const {creditId,...input}=parsed.data
  let payload: Record<string,unknown>=input
  if (input.action==='edit_terms') {
    const { data: state, error: stateError }=await createAdminSupabase().rpc('get_credit_amendment_state',{
      p_organization_id:organization.id,p_credit_id:creditId,p_actor_id:user.id,
    })
    if (stateError) return rpcError(stateError)
    const plan=buildCreditInstallmentPlan({principalAmount:input.principalAmount,interestRate:input.interestRate,
      installmentCount:input.installmentCount,frequency:input.frequency,firstDueDate:new Date(input.firstDueDate+'T12:00:00Z'),fractionDigits:state?.fractionDigits??0})
    payload={action:input.action,expectedVersion:input.expectedVersion,reason:input.reason,interestRate:input.interestRate,frequency:input.frequency,
      plan:plan.installments.map(row=>({dueDate:row.dueDate.toISOString().slice(0,10),amount:row.amount,principalComponent:row.principalComponent,interestComponent:row.interestComponent}))}
  }
  const {data,error}=await createAdminSupabase().rpc('amend_customer_credit_atomic',{
    p_organization_id:organization.id,p_credit_id:creditId,p_actor_id:user.id,p_request:payload,
  })
  if (error) return rpcError(error)
  return NextResponse.json({success:true,data},{headers:{'Cache-Control':'private, no-store'}})
})
