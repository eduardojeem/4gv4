import { z } from 'zod'
import { assertFinanceSummaryIntegrity, validateFinanceDates } from './summary-integrity'
export const controlConfigSchema = z.object({
  budgets:z.array(z.object({categoryId:z.string().uuid(),limit:z.number().finite().positive().max(999999999999.99).refine(v=>Math.abs(v*100-Math.round(v*100))<0.0001)})).max(100).refine(rows=>new Set(rows.map(r=>r.categoryId)).size===rows.length,'No repitas categorías.'),
  alerts:z.object({due:z.boolean(),reconciliation:z.boolean(),budget:z.boolean(),days:z.number().int().min(1).max(30)})
}).strict()
export type ControlConfig=z.infer<typeof controlConfigSchema>
export const defaultControlConfig:ControlConfig={budgets:[],alerts:{due:true,reconciliation:true,budget:true,days:7}}
export const METRICS=['revenue','directCosts','operatingExpenses','payrollCost','netProfit','collected','paid','netCashFlow'] as const
export type ControlMetric=typeof METRICS[number]
export const metricLabels:Record<ControlMetric,string>={revenue:'Ingresos',directCosts:'Costos directos',operatingExpenses:'Gastos',payrollCost:'Sueldos y comisiones',netProfit:'Resultado neto',collected:'Cobrado',paid:'Pagado',netCashFlow:'Flujo neto'}
export type ControlLine={id:string;metric:ControlMetric;label:string;amount:number;sourceId?:string;sourceType?:string;aggregated?:boolean}
export type DatedCommitment={id:string;label:string;date:string;amount:number;kind:'receivable'|'payable'}
export type BudgetActual={categoryId:string;name:string;amount:number}
export type ControlAlert={id:string;title:string;message:string;section:'payables'|'reconciliation'|'budgets'}
export type ControlSnapshot={accrued:{revenue:number;directCosts:number;operatingExpenses:number;payrollCost:number;netProfit:number|null};cash:{collected:number;paid:number;netCashFlow:number};complete:boolean}
export type ControlClosure={id:string;sequence:number;createdAt:string;actorId:string;reason:string;sourceVersion?:string;snapshot:ControlSnapshot;currency:string}
export type ControlReport={
 organizationId:string;sourceVersion:string;
 filters:{startDate:string;endDate:string;branchId?:string|null};today:string;timeZone:string;currency:string;generatedAt:string;
 metrics:Record<ControlMetric,number|null>;lines:ControlLine[];warnings:{code:string;message:string;sourceId?:string}[];
 discrepancies:{id:string;date:string;amount:number}[];commitments:DatedCommitment[];forecastAvailable:boolean;forecastError?:string;
 budgetMonth:string;actuals:BudgetActual[];categories:{id:string;name:string}[];config:ControlConfig;configVersion:number;
 persistenceAvailable:boolean;closures:ControlClosure[];snapshot:ControlSnapshot
}
const cents=(v:number)=>Math.round((v+Number.EPSILON)*100)/100
export function addControlDays(day:string,days:number){validateFinanceDates({startDate:day,endDate:day});const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
export function controlMonth(day:string){validateFinanceDates({startDate:day,endDate:day});const startDate=day.slice(0,7)+'-01';const date=new Date(startDate+'T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(0);return {startDate,endDate:date.toISOString().slice(0,10)}}
export function forecastCommitments(items:DatedCommitment[],today:string,days:7|30){
 const end=addControlDays(today,days-1);let incoming=0,outgoing=0
 for(const item of items){validateFinanceDates({startDate:item.date,endDate:item.date});if(!Number.isFinite(item.amount)||item.amount<0)throw new Error('Compromiso con monto inválido.');if(item.date<today||item.date>end)continue;if(item.kind==='receivable')incoming+=item.amount;else outgoing+=item.amount}
 return {end,incoming:cents(incoming),outgoing:cents(outgoing),net:cents(incoming-outgoing)}
}
export function budgetProgress(config:ControlConfig,actuals:BudgetActual[]){return config.budgets.map(budget=>{const row=actuals.find(a=>a.categoryId===budget.categoryId);const spent=row?.amount??0;if(!Number.isFinite(spent)||spent<0)throw new Error('Presupuesto con importe inválido.');return {...budget,name:row?.name??'Categoría',spent,remaining:cents(budget.limit-spent),percent:Math.round(spent/budget.limit*100)}})}
export function controlAlerts(report:Pick<ControlReport,'config'|'actuals'|'commitments'|'warnings'|'discrepancies'|'today'|'forecastAvailable'>):ControlAlert[]{
 const alerts:ControlAlert[]=[];const settings=report.config.alerts
 if(settings.due&&report.forecastAvailable){const end=addControlDays(report.today,settings.days-1);const due=report.commitments.filter(i=>i.kind==='payable'&&i.date<=end);if(due.length)alerts.push({id:'due',title:'Pagos para revisar',message:due.length+' compromisos vencidos o por vencer en '+settings.days+' días.',section:'payables'})}
 if(settings.reconciliation&&(report.warnings.length||report.discrepancies.length))alerts.push({id:'reconciliation',title:'Conciliación pendiente',message:report.warnings.length+' avisos de datos y '+report.discrepancies.length+' diferencias de caja. No se corrigen automáticamente.',section:'reconciliation'})
 if(settings.budget)for(const row of budgetProgress(report.config,report.actuals))if(row.spent>=row.limit)alerts.push({id:'budget-'+row.categoryId,title:'Límite de '+row.name,message:'El importe registrado alcanzó o superó el presupuesto mensual.',section:'budgets'})
 return alerts
}
export function snapshotChanges(before:ControlSnapshot,after:ControlSnapshot){const changes:{label:string;before:number|null;after:number|null}[]=[];for(const key of ['revenue','directCosts','operatingExpenses','payrollCost','netProfit'] as const)if(before.accrued[key]!==after.accrued[key])changes.push({label:metricLabels[key],before:before.accrued[key],after:after.accrued[key]});for(const key of ['collected','paid','netCashFlow'] as const)if(before.cash[key]!==after.cash[key])changes.push({label:metricLabels[key],before:before.cash[key],after:after.cash[key]});if(before.complete!==after.complete)changes.push({label:'Cobertura de datos',before:before.complete?1:0,after:after.complete?1:0});return changes}

export type ControlResponse=ControlReport & {detail:{metric:ControlMetric;page:number;totalItems:number;totalPages:number;sum:number}}

export function controlRequestKey(organizationId:string,branchId:string|null|undefined,startDate:string,endDate:string){validateFinanceDates({startDate,endDate});return new URLSearchParams({organizationId,startDate,endDate,...(branchId?{branchId}:{})}).toString()}

const finite=z.number().finite()
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{try{validateFinanceDates({startDate:value,endDate:value});return true}catch{return false}})
const snapshotSchema=z.object({accrued:z.object({revenue:finite,directCosts:finite,operatingExpenses:finite,payrollCost:finite,netProfit:finite.nullable()}).passthrough(),cash:z.object({collected:finite,paid:finite,netCashFlow:finite}),complete:z.boolean()}).passthrough()
const controlResponseSchema=z.object({sourceVersion:z.string(),organizationId:z.string(),filters:z.object({startDate:date,endDate:date,branchId:z.string().nullish()}).passthrough(),today:date,timeZone:z.string(),currency:z.string().regex(/^[A-Z]{3}$/),generatedAt:z.string(),metrics:z.object({revenue:finite,directCosts:finite,operatingExpenses:finite,payrollCost:finite,netProfit:finite.nullable(),collected:finite,paid:finite,netCashFlow:finite}),lines:z.array(z.object({id:z.string(),metric:z.enum(METRICS),label:z.string(),amount:finite,sourceId:z.string().optional(),sourceType:z.string().optional(),aggregated:z.boolean().optional()})),warnings:z.array(z.object({code:z.string(),message:z.string(),sourceId:z.string().optional()}).passthrough()),discrepancies:z.array(z.object({id:z.string(),date:z.string(),amount:finite})),commitments:z.array(z.object({id:z.string(),label:z.string(),date,amount:finite.nonnegative(),kind:z.enum(['receivable','payable'])})),forecastAvailable:z.boolean(),forecastError:z.string().optional(),budgetMonth:z.string().regex(/^\d{4}-\d{2}$/),actuals:z.array(z.object({categoryId:z.string(),name:z.string(),amount:finite.nonnegative()})),categories:z.array(z.object({id:z.string(),name:z.string()})),config:controlConfigSchema,configVersion:z.number().int().nonnegative(),persistenceAvailable:z.boolean(),closures:z.array(z.object({id:z.string(),sequence:z.number().int().positive(),createdAt:z.string(),actorId:z.string(),reason:z.string(),sourceVersion:z.string().optional(),snapshot:snapshotSchema,currency:z.string()})),snapshot:snapshotSchema,detail:z.object({metric:z.enum(METRICS),page:z.number().int().positive(),totalItems:z.number().int().nonnegative(),totalPages:z.number().int().positive(),sum:finite})})
export function validateControlResponse(value:unknown):ControlResponse{
 const result=controlResponseSchema.parse(value)
 const a=result.snapshot.accrued
 assertFinanceSummaryIntegrity({...result.snapshot,accrued:{...a,grossProfit:null},overdue:[],upcomingDue:[]})
 for(const closure of result.closures)assertFinanceSummaryIntegrity({...closure.snapshot,accrued:{...closure.snapshot.accrued,grossProfit:null},overdue:[],upcomingDue:[]})
 for(const line of result.lines)if(line.metric!==result.detail.metric)throw new Error('El detalle no coincide con el importe seleccionado.')
 const expected=result.metrics[result.detail.metric]
 if(expected!==null&&Math.abs(expected-result.detail.sum)>0.03)throw new Error('El origen de los importes no coincide con el total del resumen.')
 for(const key of ['revenue','directCosts','operatingExpenses','payrollCost','netProfit'] as const)if(result.metrics[key]!==result.snapshot.accrued[key])throw new Error('El resumen y sus métricas no coinciden.')
 for(const key of ['collected','paid','netCashFlow'] as const)if(result.metrics[key]!==result.snapshot.cash[key])throw new Error('El resumen de caja no coincide.')
 return result as ControlResponse
}
