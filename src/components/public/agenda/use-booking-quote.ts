'use client'
import { useEffect, useState } from 'react'

export type PublicBookingQuote = { quoteId:string; expiresAt:string; startsAt:string; endsAt:string;
  professionalId:string|null; professionalName:string|null; duration:number; price:number|null }

export function useBookingQuote(slug:string,serviceId:string|null,professionalId:string|null,startsAt:string|null,enabled:boolean,refresh:number) {
  const key=enabled && serviceId && startsAt ? `${slug}|${serviceId}|${professionalId}|${startsAt}|${refresh}`:null
  const [result,setResult]=useState<{key:string;quote:PublicBookingQuote|null;error:string|null;attemptId:string}|null>(null)
  const [acceptedId,setAcceptedId]=useState<string|null>(null)
  const [clock,setClock]=useState(()=>Date.now())
  useEffect(()=>{
    if(!key) return
    const controller=new AbortController()
    fetch(`/api/public/agenda/${encodeURIComponent(slug)}/quote`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({service_id:serviceId,professional_id:professionalId,starts_at:startsAt}),signal:controller.signal})
      .then(async response=>{
        const body=await response.json().catch(()=>({}))
        if(!controller.signal.aborted) setResult({key,quote:response.ok?body:null,error:response.ok?null:body.error||'No se pudo confirmar el horario.',attemptId:crypto.randomUUID()})
      }).catch(()=>{if(!controller.signal.aborted)setResult({key,quote:null,error:'No se pudo confirmar el horario. Revisá tu conexión.',attemptId:crypto.randomUUID()})})
    return()=>controller.abort()
  },[key,slug,serviceId,professionalId,startsAt])
  const current=result?.key===key?result:null
  const expiry=current?.quote?.expiresAt
  useEffect(()=>{
    if(!expiry || Date.parse(expiry)<=clock) return
    const timer=setTimeout(()=>setClock(Date.now()),Math.min(2147483647,Math.max(0,Date.parse(expiry)-Date.now())+1))
    return()=>clearTimeout(timer)
  },[expiry,clock])
  const expired=Boolean(expiry && Date.parse(expiry)<=clock)
  return {quote:current?.quote??null,error:current?.error??null,loading:Boolean(key && !current),expired,
    accepted:Boolean(current?.quote && acceptedId===current.quote.quoteId && !expired),
    accept:(checked:boolean)=>setAcceptedId(checked?current?.quote?.quoteId??null:null),attemptId:current?.attemptId}
}
