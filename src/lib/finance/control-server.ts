import {createAdminSupabase} from '@/lib/supabase/admin'
import {FinanceApiError,allFinanceRows,assertFinanceReportPage,getFinanceControlBase,toFinanceApiError} from './server'
import {addControlDays,controlMonth,controlConfigSchema,defaultControlConfig,type ControlReport,type DatedCommitment,type BudgetActual,type ControlClosure} from './control-model'
import type {FinanceFilters} from './types'
import {assertFinanceSummaryIntegrity} from './summary-integrity'
export const missingControlStorage=(error:{code?:string;message?:string}|null)=>Boolean(error&&(['42P01','PGRST205','PGRST202'].includes(error.code??'')))
function amount(value:unknown){if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)throw new FinanceApiError('Hay un importe no verificable.',422,'FINANCE_CONTROL_INVALID_AMOUNT');return Number(value)}
function assertRows(result:{data:unknown[]|null;error:{code?:string;message?:string}|null;count?:number|null},source:string){if(result.error)throw toFinanceApiError(result.error);assertFinanceReportPage({returnedRows:result.data?.length??0,totalRows:result.count,source})}
export async function getFinanceControlReport(organizationId:string,filters:FinanceFilters):Promise<ControlReport>{
 const base=await getFinanceControlBase(organizationId,filters),db=createAdminSupabase(),month=controlMonth(filters.startDate)
 let actualQuery=db.from('finance_obligations').select('id,category_id,amount,currency,status,finance_categories(name)',{count:'exact'}).eq('organization_id',organizationId).gte('accounting_date',month.startDate).lte('accounting_date',month.endDate).neq('status','voided').order('id')
 if(filters.branchId)actualQuery=actualQuery.eq('branch_id',filters.branchId)
 const actualResult=await allFinanceRows(actualQuery)
 assertRows(actualResult,'presupuestos mensuales')
 const totals=new Map<string,BudgetActual>()
 for(const row of actualResult.data??[]){if(row.currency!==base.currency)throw new FinanceApiError('Los gastos del mes tienen otra moneda. No se compararon con el presupuesto.',422,'FINANCE_CURRENCY_MISMATCH');const relation=Array.isArray(row.finance_categories)?row.finance_categories[0]:row.finance_categories;const key=String(row.category_id);const old=totals.get(key);totals.set(key,{categoryId:key,name:relation?.name??'Categoría',amount:(old?.amount??0)+amount(row.amount)})}
 const categoriesResult=await db.from('finance_categories').select('id,name').eq('organization_id',organizationId).eq('is_active',true).order('name').limit(100)
 if(categoriesResult.error)throw toFinanceApiError(categoriesResult.error)
 for(const row of categoriesResult.data??[])if(!totals.has(row.id))totals.set(row.id,{categoryId:row.id,name:row.name,amount:0})
 const commitments:DatedCommitment[]=[];let forecastAvailable=true;let forecastError:string|undefined
 try{
  let duesQuery=db.from('finance_obligations').select('id,concept,amount,paid_amount,currency,due_date',{count:'exact'}).eq('organization_id',organizationId).in('status',['pending','partially_paid','overdue']).lte('due_date',addControlDays(base.today,29)).order('id')
  if(filters.branchId)duesQuery=duesQuery.eq('branch_id',filters.branchId)
  const dues=await allFinanceRows(duesQuery)
  let creditsQuery=db.from('credit_installments').select('id,amount,amount_paid,due_date,customer_credits!inner(organization_id,branch_id)',{count:'exact'}).eq('customer_credits.organization_id',organizationId).in('status',['pending','late']).lte('due_date',addControlDays(base.today,29)).order('id')
  if(filters.branchId)creditsQuery=creditsQuery.eq('customer_credits.branch_id',filters.branchId)
  const credits=await allFinanceRows(creditsQuery);assertRows(dues,'vencimientos de gastos');assertRows(credits,'vencimientos de cuotas')
  for(const row of dues.data??[]){if(row.currency!==base.currency)throw new Error('Hay compromisos en otra moneda.');const remaining=Math.max(0,amount(row.amount)-amount(row.paid_amount));if(remaining>0)commitments.push({id:String(row.id),label:row.concept??'Gasto',date:String(row.due_date),amount:remaining,kind:'payable'})}
  for(const row of credits.data??[]){const remaining=Math.max(0,amount(row.amount)-amount(row.amount_paid??0));if(remaining>0)commitments.push({id:String(row.id),label:'Cuota de crédito',date:String(row.due_date).slice(0,10),amount:remaining,kind:'receivable'})}
 }catch(error){commitments.length=0;forecastAvailable=false;forecastError=error instanceof Error?error.message:'No se pudieron consultar compromisos.'}
 const scopeKey=filters.branchId??'all'
 const settings=await db.from('finance_control_events').select('sequence,payload').eq('organization_id',organizationId).eq('scope_key',scopeKey).eq('currency',base.currency).eq('kind','config').order('sequence',{ascending:false}).limit(1).maybeSingle()
 let persistenceAvailable=true
 if(settings.error){if(missingControlStorage(settings.error))persistenceAvailable=false;else throw toFinanceApiError(settings.error)}
 const config=settings.data?controlConfigSchema.parse(settings.data.payload):defaultControlConfig
 const closures:ControlClosure[]=[]
 if(persistenceAvailable){const history=await db.from('finance_control_events').select('id,sequence,actor_id,created_at,payload,currency').eq('organization_id',organizationId).eq('scope_key',scopeKey).eq('currency',base.currency).eq('kind','closure').eq('period_start',month.startDate).order('sequence',{ascending:false}).limit(20);if(history.error)throw toFinanceApiError(history.error);for(const row of history.data??[]){const payload=row.payload as {reason:string;sourceVersion?:string;snapshot:ControlReport['snapshot']};assertFinanceSummaryIntegrity({...payload.snapshot,overdue:[],upcomingDue:[]});closures.push({id:row.id,sequence:Number(row.sequence),createdAt:row.created_at,actorId:row.actor_id,reason:payload.reason,sourceVersion:payload.sourceVersion,snapshot:payload.snapshot,currency:row.currency})}}
 const a=base.snapshot.accrued,c=base.snapshot.cash
 return {sourceVersion:base.sourceVersion,organizationId,filters,today:base.today,timeZone:base.timeZone,currency:base.currency,generatedAt:new Date().toISOString(),metrics:{revenue:a.revenue,directCosts:a.directCosts,operatingExpenses:a.operatingExpenses,payrollCost:a.payrollCost,netProfit:a.netProfit,collected:c.collected,paid:c.paid,netCashFlow:c.netCashFlow},lines:base.lines,warnings:base.snapshot.coverageWarnings,discrepancies:base.discrepancies,commitments,forecastAvailable,forecastError,budgetMonth:month.startDate.slice(0,7),actuals:[...totals.values()],categories:categoriesResult.data??[],config,configVersion:Number(settings.data?.sequence??0),persistenceAvailable,closures,snapshot:base.snapshot}
}
export async function appendFinanceControl(params:{organizationId:string;branchId?:string|null;actorId:string;currency:string;kind:'config'|'closure';periodStart?:string;payload:unknown;idempotencyKey:string;expectedVersion:number}){
 const {data,error}=await createAdminSupabase().rpc('append_finance_control_event',{p_organization_id:params.organizationId,p_branch_id:params.branchId??null,p_actor_id:params.actorId,p_kind:params.kind,p_currency:params.currency,p_period_start:params.periodStart??null,p_payload:params.payload,p_idempotency_key:params.idempotencyKey,p_expected_version:params.expectedVersion})
 if(error){if(missingControlStorage(error))throw new FinanceApiError('Falta habilitar presupuestos e historial en la base de datos. La migración está preparada, no aplicada.',503,'FINANCE_CONTROL_NOT_READY');if(error.message?.includes('CONFLICT'))throw new FinanceApiError('La configuración o la operación cambió. Actualizá antes de guardar otra versión.',409,'FINANCE_CONTROL_CONFLICT');throw toFinanceApiError(error)}
 return data
}
