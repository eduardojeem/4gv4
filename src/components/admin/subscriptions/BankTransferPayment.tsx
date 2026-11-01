'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, Copy, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { money, formatDate } from '@/lib/saas/subscription-ui'

import {
 BANK_TRANSFER_RECEIPT_MAX_BYTES,
 BANK_TRANSFER_RECEIPT_MIME_TYPES,
 type BankTransferSettingsRecord,
 type BankTransferRequest as TransferRequest,
 type EligibleBankTransferPlan,
} from '@/lib/saas/bank-transfer-contract'

type TransferData = { settings: BankTransferSettingsRecord; plans: EligibleBankTransferPlan[]; requests: TransferRequest[]; pagination?: { page:number; pageSize:number; total:number; hasMore:boolean } }
const endpoint = '/api/admin/subscriptions/transfers'
const statusLabels: Record<TransferRequest['status'], string> = { awaiting_receipt:'Esperando comprobante',pending_review:'En revisión',approved:'Aprobada',rejected:'Rechazada',cancelled:'Cancelada' }

async function responseBody(response: Response) {
 const body = await response.json().catch(() => null)
 if (!response.ok || !body) throw new Error(body?.error || 'No se pudo procesar la transferencia. Intentá nuevamente.')
 return body
}

/** embedded: va dentro del bloque de pago, sin su propia tarjeta ni título. */
export function BankTransferPayment({ canPay, embedded = false }: { canPay: boolean; embedded?: boolean }) {
 const router = useRouter()
 const { scope, currentScope } = useTenantScope()
 const [loaded, setLoaded] = useState<{scope:string;data:TransferData} | null>(null)
 const [loading, setLoading] = useState(true)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState<string | null>(null)
 const [selected, setSelected] = useState('')
 const [revision, setRevision] = useState(0)
 const approved = useRef(new Set<string>())
 const data = loaded?.scope === scope ? loaded.data : null
 const isCurrent = () => currentScope.current === scope
 const refresh = useCallback(() => setRevision(value => value+1), [])
 useEffect(() => {
  if (!canPay) return
  const controller = new AbortController()
  queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true);setError(null);setBusy(false);setSelected('') } })
  fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(responseBody).then((next:TransferData) => {
   if (controller.signal.aborted || currentScope.current !== scope) return
   if (!next.settings || !Array.isArray(next.plans) || !Array.isArray(next.requests)) throw new Error('No se pudo leer la información de transferencias.')
   setLoaded({scope,data:next})
   for (const request of next.requests) {
    const key=`${scope}:${request.id}`
    if (request.status==='approved' && !approved.current.has(key)) { approved.current.add(key);router.refresh() }
   }
  }).catch(err=>{if(!controller.signal.aborted && currentScope.current===scope) setError(err instanceof Error ? err.message : 'No se pudieron cargar las transferencias.')})
   .finally(()=>{if(!controller.signal.aborted && currentScope.current===scope)setLoading(false)})
  return ()=>controller.abort()
 },[canPay,scope,currentScope,revision,router])

 const saveRequest = (request:TransferRequest) => {
  if (!isCurrent()) return
  if (!request?.id) throw new Error('No se pudo confirmar la solicitud. Actualizá el historial antes de reintentar.')
  setLoaded(previous=>previous?.scope===scope ? {scope,data:{...previous.data,requests:[request,...previous.data.requests.filter(item=>item.id!==request.id)]}} : previous)
  if(request.status==='approved')router.refresh()
 }
 const create = async () => {
  if(!selected || busy || !canPay)return
  setBusy(true);setError(null)
  try {
   const body=await responseBody(await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planCode:selected})}))
   saveRequest(body.request)
  } catch(err) {if(isCurrent())setError(err instanceof Error ? err.message : 'No se pudo crear la solicitud.')}
  finally {if(isCurrent())setBusy(false)}
 }
 const loadMore = async () => {
  if (!data?.pagination?.hasMore || busy || loading) return
  setBusy(true);setError(null)
  try {
   const next:TransferData = await responseBody(await fetch(`${endpoint}?page=${data.pagination.page+1}`,{cache:'no-store'}))
   if (!isCurrent()) return
   if (!Array.isArray(next.requests) || !next.pagination) throw new Error('No se pudieron cargar las solicitudes anteriores.')
   setLoaded(previous=>previous?.scope===scope ? {scope,data:{...previous.data,pagination:next.pagination,requests:[...previous.data.requests,...next.requests.filter(item=>!previous.data.requests.some(current=>current.id===item.id))]}} : previous)
  } catch(err){if(isCurrent())setError(err instanceof Error?err.message:'No se pudieron cargar las solicitudes anteriores.')}
  finally{if(isCurrent())setBusy(false)}
 }
 const cancel = async (requestId:string):Promise<void> => {
  if(busy || !canPay)return
  setBusy(true);setError(null)
  try {const body=await responseBody(await fetch(`${endpoint}/${encodeURIComponent(requestId)}/cancel`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));saveRequest(body.request)}
  catch(err){if(isCurrent())setError(err instanceof Error ? err.message : 'No se pudo cancelar la solicitud.')}
  finally{if(isCurrent())setBusy(false)}
 }
 const upload = async (requestId:string,file:File,operationReference:string):Promise<boolean> => {
  if(busy || !canPay)return false
  setBusy(true);setError(null)
  try {
   const form=new FormData();form.append('file',file);if(operationReference)form.append('operationReference',operationReference)
   const body=await responseBody(await fetch(`${endpoint}/${encodeURIComponent(requestId)}/receipt`,{method:'POST',body:form}))
   saveRequest(body.request);return isCurrent()
  }catch(err){if(isCurrent())setError(err instanceof Error ? err.message : 'No se pudo enviar el comprobante.');return false}
  finally{if(isCurrent())setBusy(false)}
 }
 if(!canPay)return null
 const active=data?.requests.some(request=>request.status==='awaiting_receipt'||request.status==='pending_review')
 const content=<div className="space-y-5" aria-busy={loading||busy}>
   <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Importes en guaraníes, definidos por el plan elegible.</p><Button type="button" size="sm" variant="outline" disabled={loading||busy} onClick={refresh}><RefreshCw className="mr-2 h-4 w-4"/>Actualizar</Button></div>
   {error&&<div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
   {loading&&!data&&<p role="status" className="flex gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>Cargando transferencias…</p>}
   {data&&<>
    {!data.settings.enabled ? <p className="text-sm text-muted-foreground">El pago por transferencia no está disponible en este momento.</p> :
     data.plans.length===0 ? <p className="text-sm text-muted-foreground">No hay planes elegibles para pagar por transferencia en este momento.</p> :
     <div className="space-y-3 rounded-xl border p-4">
      <label htmlFor="transfer-plan" className="text-sm font-medium">Plan para un período mensual</label>
      <select id="transfer-plan" className="flex min-h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected} disabled={busy||loading||active} onChange={event=>setSelected(event.target.value)}>
       <option value="">Seleccioná un plan</option>{data.plans.map(plan=><option key={plan.code} value={plan.code}>{plan.name} — {money(plan.price,plan.currency)} / mes</option>)}
      </select>
      <Button type="button" disabled={!selected||busy||loading||active} onClick={()=>void create()}>{busy ? 'Procesando…' : 'Generar solicitud de transferencia'}</Button>
      {active&&<p className="text-sm text-muted-foreground">Ya tenés una solicitud abierta. Usá su referencia y comprobante antes de iniciar otra.</p>}
      <p className="text-xs text-muted-foreground">Generar la solicitud todavía no registra un pago ni activa el plan. Los datos bancarios y el importe confirmado aparecen en la solicitud.</p>
     </div>}
    <div className="space-y-4"><h3 className="text-sm font-semibold">Solicitudes de transferencia</h3>
     {data.requests.length===0&&<p className="text-sm text-muted-foreground">Todavía no tenés solicitudes de transferencia.</p>}
     {data.requests.map(request=><TransferRequestCard key={`${scope}:${request.id}`} request={request} busy={busy||loading} upload={upload} cancel={cancel}/>)}
     {data.pagination?.hasMore&&<div className="space-y-2"><p className="text-sm text-muted-foreground">Mostrando las últimas {data.requests.length} solicitudes. Hay solicitudes anteriores.</p><Button type="button" variant="outline" disabled={busy||loading} onClick={()=>void loadMore()}>Ver solicitudes anteriores</Button></div>}
    </div>
   </>}
  </div>
 if(embedded)return <div id="bank-transfer" className="scroll-mt-24 space-y-3"><p className="text-sm text-muted-foreground">Pagá un mes por transferencia. El plan se actualiza cuando aprobamos el comprobante.</p>{content}</div>
 return <Card id="bank-transfer" className="scroll-mt-24">
  <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5"/>Transferencia bancaria</CardTitle>
   <CardDescription>Pagá un período mensual por transferencia. La suscripción se actualiza únicamente después de la aprobación del comprobante.</CardDescription></CardHeader>
  <CardContent>{content}</CardContent>
 </Card>
}

/** Botón chico para copiar un dato bancario; el portapapeles puede no estar disponible. */
function CopyButton({value,label}:{value:string;label:string}) {
 const [copied,setCopied]=useState(false)
 const copy=async()=>{try{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1500)}catch{/* Sin permiso: el dato sigue visible para copiarlo a mano. */}}
 return <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={()=>void copy()} aria-label={copied?`${label} copiado`:`Copiar ${label.toLowerCase()}`}>{copied?<Check className="h-3.5 w-3.5 text-emerald-600"/>:<Copy className="h-3.5 w-3.5"/>}</Button>
}

function TransferRequestCard({request,busy,upload,cancel}:{request:TransferRequest;busy:boolean;upload:(id:string,file:File,reference:string)=>Promise<boolean>;cancel:(id:string)=>Promise<void>}) {
 const [file,setFile]=useState<File|null>(null)
 const [reference,setReference]=useState('')
 const [error,setError]=useState<string|null>(null)
 const [receiptUrl,setReceiptUrl]=useState<string|null>(null)
 const [opening,setOpening]=useState(false)
 const input=useRef<HTMLInputElement>(null)
 const bank=request.bank_snapshot
 const choose=(event:ChangeEvent<HTMLInputElement>)=>{
  const selected=event.target.files?.[0]??null;setFile(null);setError(null)
  if(!selected)return
  if(!BANK_TRANSFER_RECEIPT_MIME_TYPES.some(type=>type===selected.type)||selected.size>BANK_TRANSFER_RECEIPT_MAX_BYTES||selected.size===0){setError('Elegí un archivo JPEG, PNG o PDF de hasta 3 MB.');event.target.value='';return}
  setFile(selected)
 }
 const submit=async()=>{
  if(!file){setError('Adjuntá el comprobante de la transferencia.');return}
  setError(null)
  if(await upload(request.id,file,reference.trim())){setFile(null);setReference('');if(input.current)input.current.value=''}
 }
 const viewReceipt=async()=>{
  setOpening(true);setError(null)
  try {const body=await responseBody(await fetch(`${endpoint}/${encodeURIComponent(request.id)}/receipt`,{cache:'no-store'}));if(typeof body.url!=='string'||!body.url.startsWith('https://'))throw new Error('No se pudo abrir el comprobante.');setReceiptUrl(body.url)}
  catch(err){setError(err instanceof Error?err.message:'No se pudo abrir el comprobante.')}
  finally{setOpening(false)}
 }
 return <section className="space-y-4 rounded-xl border p-4" aria-label={`Solicitud ${request.reference}`}>
  <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{request.plan_name} · {money(request.amount,request.currency)}</p><p className="flex items-center gap-1 text-sm">Referencia: <strong className="break-all">{request.reference}</strong><CopyButton value={request.reference} label="Referencia"/></p></div><Badge variant={request.status==='rejected'?'destructive':'secondary'}>{statusLabels[request.status]}</Badge></div>
  <p className="text-xs text-muted-foreground">Solicitada: {formatDate(request.created_at)}</p>
  {request.status==='cancelled'&&<p role="status" className="text-sm text-muted-foreground">Solicitud cancelada. Podés generar una nueva.</p>}
  {request.status==='rejected'&&<p role="status" className="text-sm text-destructive">{request.rejection_reason||'Comprobante rechazado.'} Podés generar una nueva solicitud.</p>}
  {request.status==='approved'&&<p role="status" className="text-sm">Pago aprobado.{request.period_ends_at ? ` Período vigente hasta ${formatDate(request.period_ends_at)}.` : ' Actualizá la suscripción para consultar su vigencia.'}</p>}
  {request.status==='pending_review'&&<p role="status" className="text-sm text-muted-foreground">El comprobante está en revisión. Todavía no modifica la vigencia del plan.</p>}
  {request.status==='awaiting_receipt'&&<>
   <dl className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
    {([['Banco',bank.bankName],['Titular',bank.accountHolder],['Número de cuenta',bank.accountNumber],['Alias',bank.accountAlias],['Importe',money(request.amount,request.currency)]] as const).filter(([,value])=>Boolean(value)).map(([label,value])=><div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="flex items-center gap-1 break-all font-medium">{value}{label!=='Banco'&&<CopyButton value={label==='Importe'?String(request.amount):value} label={label}/>}</dd></div>)}
   </dl>
   {bank.instructions&&<p className="whitespace-pre-wrap text-sm">{bank.instructions}</p>}
   <ol className="list-decimal space-y-1 pl-5 text-sm"><li>Transferí exactamente el importe a la cuenta de arriba.</li><li>Poné la referencia de la solicitud en el concepto, si tu banco lo permite.</li><li>Adjuntá el comprobante acá abajo. Te avisamos por correo cuando lo revisemos.</li></ol>
   <div className="space-y-3">
    <label className="block text-sm font-medium" htmlFor={`operation-${request.id}`}>Referencia de la operación bancaria (opcional)</label>
    <Input id={`operation-${request.id}`} maxLength={160} value={reference} onChange={event=>setReference(event.target.value)} disabled={busy}/>
    <label className="block text-sm font-medium" htmlFor={`receipt-${request.id}`}>Comprobante (JPEG, PNG o PDF · máximo 3 MB)</label>
    <Input ref={input} id={`receipt-${request.id}`} type="file" accept="image/jpeg,image/png,application/pdf" onChange={choose} disabled={busy}/>
    <div className="flex flex-wrap gap-2"><Button type="button" onClick={()=>void submit()} disabled={busy||!file}>Enviar comprobante para revisión</Button><Button type="button" variant="ghost" className="text-muted-foreground" onClick={()=>void cancel(request.id)} disabled={busy}>Cancelar solicitud</Button></div>
   </div>
  </>}
  {request.operation_reference&&<p className="text-sm">Operación bancaria: {request.operation_reference}</p>}
  {request.receipt_path&&<div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" type="button" onClick={()=>void viewReceipt()} disabled={opening||busy}>{opening?'Preparando…':'Consultar comprobante'}</Button>{receiptUrl&&<a className="text-sm text-primary underline" href={receiptUrl} target="_blank" rel="noopener noreferrer">Abrir comprobante</a>}</div>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 </section>
}
