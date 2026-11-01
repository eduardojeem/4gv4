import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  bankTransferSettingsSchema, createBankTransferSchema, reviewBankTransferSchema, submitBankTransferReceiptSchema,
  type BankTransferSettings, type BankTransferSettingsRecord, type BankTransferRequest, type BankTransferReceiptInput,
  type BankTransferReviewInput, type BankTransferStatus, type EligibleBankTransferPlan,
} from './bank-transfer-contract'

export class BankTransferError extends Error {
  constructor(public readonly code:string, message:string, public readonly status:number) { super(message) }
}
export { BankTransferError as BankTransferServiceError }
const errors:Record<string,[number,string]> = {
 TRANSFER_FORBIDDEN:[403,'No tenés permiso para gestionar esta solicitud.'],TRANSFER_SUPERADMIN_REQUIRED:[403,'Se requiere acceso de superadministrador.'],
 TRANSFER_OWNER_REQUIRED:[403,'Solo el dueño puede activar otro plan.'],TRANSFER_NOT_FOUND:[404,'La solicitud o el comercio no existen.'],
 TRANSFER_DISABLED:[409,'Las transferencias no están disponibles por el momento.'],TRANSFER_OPEN_EXISTS:[409,'Ya hay una solicitud abierta para este comercio.'],
 TRANSFER_PLAN_NOT_ELIGIBLE:[409,'El plan no está disponible para transferencia. Podés renovar tu plan actual o activar un plan desde Free. Para cambiar entre planes pagos, gestioná primero el cambio de plan.'],
 TRANSFER_PLAN_CHANGE_UNSUPPORTED:[409,'El plan del comercio cambió. Gestioná el cambio de plan por separado antes de aprobar esta transferencia.'],
 TRANSFER_INVALID_STATE:[409,'La solicitud ya fue procesada o todavía no tiene comprobante.'],TRANSFER_DUPLICATE_OPERATION:[409,'Esta operación bancaria ya se registró en otra solicitud.'],
 TRANSFER_RECEIPT_INVALID:[400,'El comprobante privado no es válido o no coincide con su solicitud.'],TRANSFER_REJECTION_REASON_REQUIRED:[400,'Indicá el motivo del rechazo.'],
 TRANSFER_BANK_REFERENCE_REQUIRED:[400,'Indicá la referencia bancaria verificada.'],TRANSFER_INVALID_DECISION:[400,'La decisión no es válida.'],TRANSFER_SETTINGS_INVALID:[400,'La configuración bancaria no es válida.'],
}
function databaseError(error:{message?:string;code?:string}):never {
 const code=Object.keys(errors).find(key=>error.message?.includes(key))
 if(code){const [status,message]=errors[code];throw new BankTransferError(code,message,status)}
 throw new BankTransferError('TRANSFER_UNAVAILABLE','No se pudo completar la operación. Reintentá.',503)
}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await createAdminSupabase().rpc(name,args)
 if(error)databaseError(error)
 if(data===null)throw new BankTransferError('TRANSFER_UNAVAILABLE','No se pudo completar la operación.',503)
 return data as T
}
function settings(row:Record<string,unknown>):BankTransferSettingsRecord {
 return {...bankTransferSettingsSchema.parse({enabled:row.enabled,bankName:row.bank_name,accountHolder:row.account_holder,accountNumber:row.account_number,accountAlias:row.account_alias,currency:row.currency,instructions:row.instructions}),updatedAt:typeof row.updated_at==='string'?row.updated_at:null}
}
export async function getBankTransferSettings():Promise<BankTransferSettingsRecord>{
 const {data,error}=await createAdminSupabase().from('subscription_bank_transfer_settings').select('*').eq('id',true).single()
 if(error)databaseError(error)
 return settings(data)
}
export async function updateBankTransferSettings(actorId:string,input:BankTransferSettings){
 const parsed=bankTransferSettingsSchema.parse(input)
 return settings(await rpc<Record<string,unknown>>('update_subscription_bank_transfer_settings',{p_actor_id:actorId,p_settings:parsed}))
}
export function getEligibleBankTransferPlans(organizationId:string,actorId:string){
 return rpc<EligibleBankTransferPlan[]>('get_subscription_bank_transfer_plans',{p_organization_id:organizationId,p_actor_id:actorId})
}
export function createBankTransferRequest(organizationId:string,actorId:string,planCode:string){
 const parsed=createBankTransferSchema.parse({planCode})
 return rpc<BankTransferRequest>('create_subscription_bank_transfer',{p_organization_id:organizationId,p_actor_id:actorId,p_plan_code:parsed.planCode})
}
export function submitBankTransferReceipt(organizationId:string,actorId:string,requestId:string,input:BankTransferReceiptInput){
 const parsed=submitBankTransferReceiptSchema.parse(input)
 return rpc<BankTransferRequest>('submit_subscription_bank_transfer_receipt',{p_organization_id:organizationId,p_actor_id:actorId,p_request_id:requestId,p_path:parsed.path,p_mime_type:parsed.mimeType,p_size:parsed.size,p_operation_reference:parsed.operationReference??null})
}
/** Solo mientras espera el comprobante; la base verifica actor y estado. */
export function cancelBankTransferRequest(organizationId:string,actorId:string,requestId:string){
 return rpc<BankTransferRequest>('cancel_subscription_bank_transfer',{p_organization_id:organizationId,p_actor_id:actorId,p_request_id:requestId})
}
export function reviewBankTransferRequest(actorId:string,requestId:string,input:BankTransferReviewInput){
 const parsed=reviewBankTransferSchema.parse(input)
 return rpc<{request:BankTransferRequest;applied:boolean}>('review_subscription_bank_transfer',{p_actor_id:actorId,p_request_id:requestId,p_decision:parsed.decision,p_reason:parsed.reason??null,p_bank_operation_reference:parsed.bankOperationReference??null})
}
/** The API must authorize its actor first. null organization is reserved for superadmin APIs. */
export async function getBankTransferRequest(organizationId:string|null,requestId:string):Promise<BankTransferRequest|null>{
 let query=createAdminSupabase().from('subscription_bank_transfer_requests').select('*').eq('id',requestId)
 if(organizationId)query=query.eq('organization_id',organizationId)
 const {data,error}=await query.maybeSingle();if(error)databaseError(error)
 return data as BankTransferRequest|null
}
export async function listBankTransferRequests(options:{organizationId?:string;status?:BankTransferStatus;page?:number;pageSize?:number}={}){
 const page=Math.max(1,Math.floor(options.page||1)),pageSize=Math.min(25,Math.max(1,Math.floor(options.pageSize||25)))
 let query=createAdminSupabase().from('subscription_bank_transfer_requests').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false})
 if(options.organizationId)query=query.eq('organization_id',options.organizationId)
 if(options.status)query=query.eq('status',options.status)
 const {data,error,count}=await query.range((page-1)*pageSize,page*pageSize-1);if(error)databaseError(error)
 if(count===null)throw new BankTransferError('TRANSFER_UNAVAILABLE','No se pudo verificar la cobertura de solicitudes.',503)
 return {requests:(data??[]) as BankTransferRequest[],pagination:{page,pageSize,total:count,hasMore:page*pageSize<count}}
}
export function getOrganizationBankTransfers(organizationId:string,page=1){return listBankTransferRequests({organizationId,page})}
