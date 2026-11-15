import 'server-only'
import {createAdminSupabase} from '@/lib/supabase/admin'

/** Explicit columns: never export passwords, device unlock codes, credentials or integration payloads. */
export const BUSINESS_EXPORT_DATASETS={
 branches:'id,organization_id,code,name,address,city,phone,email,is_active,created_at',
 categories:'id,organization_id,name,description,parent_id,is_active,created_at',
 products:'id,organization_id,sku,name,description,category_id,brand,purchase_price,sale_price,wholesale_price,stock_quantity,barcode,image_url,images,is_active,created_at',
 customers:'id,organization_id,customer_code,name,email,phone,ruc,address,city,status,credit_limit,current_balance,pending_amount,created_at',
 suppliers:'id,organization_id,name,contact_name,email,phone,address,tax_id,city,country,payment_terms,current_debt,created_at',
 sales:'id,organization_id,code,total_amount,subtotal_amount,tax_amount,discount_amount,payment_method,payment_status,status,customer_id,branch_id,created_at',
 sale_items:'id,organization_id,sale_id,product_id,quantity,unit_price,discount_amount,subtotal,total_price,created_at',
 customer_orders:'id,organization_id,customer_id,order_number,status,payment_status,payment_method,fulfillment_type,customer_name,customer_email,customer_phone,customer_address,subtotal,tax_amount,shipping_cost,discount_amount,total,created_at',
 customer_order_items:'id,organization_id,order_id,product_id,product_name,product_sku,quantity,unit_price,subtotal,created_at',
 repairs:'id,organization_id,customer_id,ticket_number,device_type,device_brand,device_model,serial_number,imei,problem_description,diagnosis,solution,status,estimated_cost,final_cost,labor_cost,parts_cost,warranty_months,warranty_expires_at,payment_status,paid_amount,created_at',
 customer_credits:'id,organization_id,customer_id,sale_id,principal,interest_rate,term_months,start_date,status,credit_code,created_at',
 credit_installments:'id,organization_id,credit_id,installment_number,due_date,amount,principal_component,interest_component,status,paid_at,payment_method,amount_paid,created_at',
 credit_payments:'id,organization_id,credit_id,installment_id,amount,payment_method,created_at,notes',
 repair_parts:'id,organization_id,repair_id,product_id,part_name,quantity,unit_cost,total_cost,unit_price,created_at',
 appointments:'id,organization_id,number,professional_id,customer_id,customer_name,customer_phone,service_product_id,service_name,price,starts_at,ends_at,status,created_at',
 agenda_professionals:'id,organization_id,name,color,phone,is_active,created_at',
 agenda_time_off:'id,organization_id,professional_id,starts_at,ends_at,reason,created_at',
 finance_obligations:'id,organization_id,branch_id,concept,amount,paid_amount,currency,vendor,accounting_date,due_date,status,created_at',
 finance_payments:'id,organization_id,branch_id,obligation_id,direction,reverses_payment_id,amount,payment_method,payment_date,reference,created_at',
 cash_movements:'id,organization_id,register_id,type,amount,payment_method,session_id,branch_id,sale_id,created_at',
 purchase_orders:'id,organization_id,ordernumber,supplierid,suppliername,status,orderdate,subtotal,taxamount,totalamount,currency',
 purchase_order_items:'id,organization_id,order_id,product_id,name,quantity,unitprice,linetotal,status',
} as const
export type BusinessExportTable=keyof typeof BUSINESS_EXPORT_DATASETS
export type ExportReader=(table:BusinessExportTable,columns:string,organizationId:string,after:string|null)=>Promise<Array<Record<string,unknown>>>
export async function collectBusinessExport(organizationId:string,read:ExportReader){
 const startedAt=new Date().toISOString(),datasets:Record<string,Array<Record<string,unknown>>>={}
 let bytes=0,total=0
 for(const [table,columns] of Object.entries(BUSINESS_EXPORT_DATASETS)){
  const rows:Array<Record<string,unknown>>=[];let after:string|null=null
  for(;;){
   const page=await read(table as BusinessExportTable,columns,organizationId,after)
   if(!page.length)break
   for(const row of page){
    if(row.organization_id!==organizationId||typeof row.id!=='string'||(after!==null&&row.id<=after))throw new Error('No se pudo verificar el alcance de la exportación.')
    after=row.id;bytes+=Buffer.byteLength(JSON.stringify(row),'utf8');total++
    if(bytes>40*1024*1024||total>200000)throw new Error('La exportación supera el tamaño disponible. Solicitá una copia a soporte; no se descargaron datos incompletos.')
    // Project again: an unexpected database field must not leak into the file.
    rows.push(Object.fromEntries(columns.split(',').map(key=>[key,row[key]??null])))
   }
  }
  datasets[table]=rows
 }
 return {format:'mitiendapy-business-data',version:1,organizationId,startedAt,finishedAt:new Date().toISOString(),scope:'Datos comerciales de las secciones enumeradas. No es una copia restaurable ni una captura transaccional. No incluye archivos binarios, nómina, claves ni la configuración completa de las herramientas o integraciones. Para una copia adicional, contactá a soporte.',datasets}
}
export async function exportOrganizationBusinessData(organizationId:string){
 const admin=createAdminSupabase()
 return collectBusinessExport(organizationId,async(table,columns,org,after)=>{
  const relation=table==='repair_parts'?'repairs':table==='credit_installments'||table==='credit_payments'?'customer_credits':null
  const projection=relation?columns.split(',').filter(key=>key!=='organization_id').join(',')+',export_owner:'+relation+'!inner(organization_id)':columns
  let query=admin.from(table).select(projection).eq(relation?'export_owner.organization_id':'organization_id',org).order('id').limit(500)
  if(after)query=query.gt('id',after)
  const {data,error}=await query
  if(error)throw new Error('No se pudo completar la exportación. Intentá nuevamente o contactá a soporte.')
  const rows=data as unknown as Array<Record<string,unknown>>
  return relation?rows.map(row=>({...row,organization_id:(row.export_owner as {organization_id?:unknown}|null)?.organization_id})):rows
 })
}