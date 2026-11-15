'use client'
import {useState,useRef,useEffect} from 'react'
import {Button} from '@/components/ui/button'
import {useOptionalActiveOrganization} from '@/contexts/ActiveOrganizationContext'
import {getBrowserOrganizationId} from '@/lib/saas/active-organization'
export function BusinessDataDownload(){
 const context=useOptionalActiveOrganization(),org=context?.organization
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null)
 const request=useRef<AbortController|null>(null)
 useEffect(()=>()=>request.current?.abort(),[org?.id])
 if(org?.role!=='owner')return null
 async function download(){
  const id=org!.id,controller=new AbortController();request.current=controller;setBusy(true);setError(null)
  try{
   const response=await fetch('/api/admin/subscriptions/data-export',{cache:'no-store',signal:controller.signal,headers:{'x-export-organization-id':id}})
   if(!response.ok){const body=await response.json();throw new Error(body.error||'No se pudo descargar.')}
   const blob=await response.blob()
   if(controller.signal.aborted||getBrowserOrganizationId()!==id)throw new Error('La empresa cambió. Iniciá otra descarga.')
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`datos-comerciales-${id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'No se pudo descargar.')}
  finally{if(request.current===controller)setBusy(false)}
 }
 return <section className="rounded-2xl border bg-card p-4 space-y-2"><h3 className="font-semibold">Conservá una copia de tus datos</h3><p className="text-sm text-muted-foreground">Descargá productos, clientes, ventas, pedidos, reparaciones y movimientos financieros en JSON. Incluye cuotas y turnos. No incluye nómina ni archivos adjuntos y no permite restaurar la empresa automáticamente.</p><Button variant="outline" disabled={busy} onClick={download}>{busy?'Preparando archivo…':'Descargar datos comerciales'}</Button>{error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}</section>
}