'use client'
import type { AgendaProfessional,AgendaService,AgendaProfessionalRate } from '@/lib/agenda/agenda-server'
import { professionalDoesService } from '@/lib/agenda/agenda-server'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/currency'
import { parseInheritedNumber } from '@/lib/agenda/booking-config'
export type RatesEditorProps={professional:AgendaProfessional;services:AgendaService[];rates:AgendaProfessionalRate[];currency:string;onSaved:(rates:AgendaProfessionalRate[])=>void|Promise<void>}
type Draft={product_id:string;price:string;duration_minutes:string;buffer_minutes:string}
export function ProfessionalRatesEditor({professional,services,rates,currency,onSaved}:RatesEditorProps){
  const [draft,setDraft]=useState<Draft[]>(()=>services.map(service=>{
    const rate=rates.find(row=>row.professional_id===professional.id && row.product_id===service.product_id)
    return {product_id:service.product_id,price:rate?.price==null?'':String(rate.price),duration_minutes:rate?.duration_minutes==null?'':String(rate.duration_minutes),buffer_minutes:rate?.buffer_minutes==null?'':String(rate.buffer_minutes)}
  }))
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const change=(id:string,field:keyof Omit<Draft,'product_id'>,value:string)=>setDraft(rows=>rows.map(row=>row.product_id===id?{...row,[field]:value}:row))
  const save=async()=>{
    setError(null)
    let values:AgendaProfessionalRate[]
    try{values=draft.map(row=>({professional_id:professional.id,product_id:row.product_id,price:parseInheritedNumber(row.price),duration_minutes:parseInheritedNumber(row.duration_minutes),buffer_minutes:parseInheritedNumber(row.buffer_minutes)}))
      if(values.some(row=>(row.duration_minutes!==null && (!Number.isInteger(row.duration_minutes)||row.duration_minutes<5||row.duration_minutes>600)) || (row.buffer_minutes!==null && (!Number.isInteger(row.buffer_minutes)||row.buffer_minutes>120)) || (row.price!==null && row.price>999999999999.99)))throw new Error('INVALID_NUMBER')
    }catch{setError('Revisá los valores: precio no negativo, duración de 5 a 600 min y margen de 0 a 120 min.');return}
    setBusy(true)
    try{
      const response=await fetch('/api/agenda/professional-rates',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({professional_id:professional.id,rates:values.map(({professional_id:_id,...row})=>row)})})
      const body=await response.json().catch(()=>({}))
      if(!response.ok){setError(body.error||'No se pudieron guardar las tarifas.');return}
      await onSaved(values)
    }catch{setError('No se pudieron guardar las tarifas. Revisá tu conexión.')}finally{setBusy(false)}
  }
  return <fieldset className="space-y-3" disabled={busy}>
    <legend className="font-medium">Tarifas de {professional.name}</legend>
    <p className="text-sm text-muted-foreground">Vacío = heredar del servicio. Cero = sin costo o sin margen. Cambiar una tarifa no asigna el servicio al profesional ni cambia los turnos ya reservados.</p>
    {services.map(service=>{
      const row=draft.find(item=>item.product_id===service.product_id)
      if(!row)return null
      return <div key={service.product_id} className="space-y-2 border-b pb-3">
        <p className="text-sm font-medium">{service.name}{!professionalDoesService(professional,service.product_id)&&' · No asignado'}</p>
        <p className="text-xs text-muted-foreground">Base: {formatCurrency(service.price,{currency})} · {service.duration_minutes} min + {service.buffer_minutes??0} min entre turnos</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {([['price','Precio',0,999999999999.99],['duration_minutes','Duración',5,600],['buffer_minutes','Margen',0,120]] as const).map(([field,label,min,max])=><label key={field} className="space-y-1 text-sm">{label}
            <Input type="number" min={min} max={max} step={field==='price'?'0.01':'1'} className="min-h-11 text-base" aria-label={`${label} de ${service.name}`} value={row[field]} placeholder="Heredar" onChange={event=>change(row.product_id,field,event.target.value)}/>
          </label>)}
        </div>
      </div>
    })}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" className="min-h-11" disabled={busy} onClick={()=>void save()}>{busy?'Guardando…':'Guardar tarifas'}</Button>
  </fieldset>
}
