import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { summarizeRepairDebts } from '@/lib/customers/repair-debt-summary'
import { readAllCreditRows } from '@/lib/credits/portfolio'
import { chunkIds } from '@/lib/customers/batch'
import { z } from 'zod'
const batchSchema=z.object({customerIds:z.array(z.string().uuid()).max(500).default([])})
export const POST=withTenantAuth({permission:'crm.customers.read',module:'crm'},async(request,{organization})=>{
  try {
    const parsed=batchSchema.safeParse(await request.json().catch(()=>null))
    if (!parsed.success) return NextResponse.json({error:'Lista de clientes inválida.'},{status:400})
    const customerIds=[...new Set(parsed.data.customerIds)]
    const admin=createAdminSupabase()
    const [credits,repairs,settings]=await Promise.all([
      Promise.all(chunkIds(customerIds,200).map(ids=>readAllCreditRows((from,to)=>admin.from('customer_credits')
        .select('id,customer_id,principal,interest_rate,term_months,start_date,status').eq('organization_id',organization.id)
        .in('customer_id',ids).order('id').range(from,to)))).then(rows => rows.flat()),
      Promise.all(chunkIds(customerIds,200).map(ids=>readAllCreditRows((from,to)=>admin.from('repairs')
        .select('id,customer_id,status,delivered_at,pricing_mode,labor_cost,final_cost,estimated_cost,discount_amount,paid_amount,parts:repair_parts(unit_price,unit_cost,quantity,line_type)')
        .eq('organization_id',organization.id).in('customer_id',ids).is('deleted_at',null).order('id').range(from,to)))).then(rows => rows.flat()),
      admin.from('organization_settings').select('timezone').eq('organization_id',organization.id).maybeSingle(),
    ])
    if (settings.error) throw settings.error
    const creditIds=credits.filter(c=>!['cancelled','cancelado','canceled'].includes(String(c.status))).map(c=>String(c.id))
    const [installments,payments]=await Promise.all([
      Promise.all(chunkIds(creditIds,200).map(ids=>readAllCreditRows((from,to)=>admin.from('credit_installments')
        .select('id,credit_id,installment_number,due_date,amount,status,amount_paid,paid_at').in('credit_id',ids).order('id').range(from,to)))).then(rows => rows.flat()),
      Promise.all(chunkIds(creditIds,200).map(ids=>readAllCreditRows((from,to)=>admin.from('credit_payments')
        .select('id,credit_id,installment_id,amount,payment_method,created_at').in('credit_id',ids).order('id').range(from,to)))).then(rows => rows.flat()),
    ])
    return NextResponse.json({credits,installments,payments:payments.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),
      repairDebts:summarizeRepairDebts(repairs),timeZone:settings.data?.timezone||'America/Asuncion'})
  } catch {
    return NextResponse.json({error:'No se pudo cargar la situación crediticia completa.'},{status:500})
  }
})
