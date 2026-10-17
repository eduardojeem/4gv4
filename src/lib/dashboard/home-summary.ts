import { z } from 'zod'
import { getCachedDashboardSummary } from './summary-cache'
const amount = z.number().finite()
const count = z.number().int().nonnegative()
const schema = z.object({
 version:z.literal(1),timeZone:z.string().min(1),today:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),generatedAt:z.string().datetime({offset:true}),
 sales:z.object({todayAmount:amount,todayCount:count,daily:z.array(amount).length(7)}),
 customers:z.object({newCount:count,daily:z.array(count).length(7)}),
 catalog:z.object({physicalCount:count,servicesCount:count,lowStockCount:count}),
 orders:z.object({activeCount:count}),
 repairs:z.object({activeCount:count,todayCount:count,todayAmount:amount,deliveredCount:count,deliveredAmount:amount,readyCount:count,readyAmount:amount}),
})
export type DashboardHomeSummary = z.infer<typeof schema>
export type HomeSummaryScope = {userId:string;organizationId:string;branchId?:string|null;role:string;modules:string[]}
export type HomeSummaryRpcClient = {rpc:(name:'dashboard_home_summary',args:{p_organization_id:string;p_branch_id:string|null;p_modules:string[]})=>PromiseLike<{data:unknown;error:unknown}>&{abortSignal:(signal:AbortSignal)=>PromiseLike<{data:unknown;error:unknown}>}}
export async function fetchDashboardHomeSummary(client:HomeSummaryRpcClient,scope:HomeSummaryScope,options:{signal?:AbortSignal;force?:boolean}={}):Promise<DashboardHomeSummary>{
 const modules=[...new Set(scope.modules)].sort()
 const key=JSON.stringify(['home-v1',scope.userId,scope.organizationId,scope.branchId||'all','business-today:last7days',scope.role,modules])
 return getCachedDashboardSummary(key,async()=>{
  const request=client.rpc('dashboard_home_summary',{p_organization_id:scope.organizationId,p_branch_id:scope.branchId&&scope.branchId!=='all'?scope.branchId:null,p_modules:modules})
  const {data,error}=await(options.signal?request.abortSignal(options.signal):request)
  if(error){
   const code=(error as {code?:string}).code
   if(code==='PGRST202'||code==='42883')throw new Error('Aplicá la migración dashboard_home_summary para habilitar los indicadores y reintentá.')
   throw new Error('No se pudieron cargar los indicadores. Reintentá la consulta.')
  }
  const parsed=schema.safeParse(data)
  if(!parsed.success)throw new Error('Los indicadores recibidos están incompletos. Actualizá la aplicación y reintentá.')
  return parsed.data
 },{...options,ttlMs:30000})
}
