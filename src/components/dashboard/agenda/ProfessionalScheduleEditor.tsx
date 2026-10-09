'use client'
import type { OpeningHours } from '@/lib/agenda/slots'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { openingHoursSchema } from '@/lib/agenda/booking-config'
import { WEEKDAY_LABELS } from '@/lib/agenda/time'
export type ScheduleEditorProps={name:string;value:OpeningHours|null;onSave:(value:OpeningHours|null)=>Promise<boolean>}
export function ProfessionalScheduleEditor({name,value,onSave}:ScheduleEditorProps){
  const [hours,setHours]=useState<OpeningHours|null>(value)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const save=async()=>{
    if(hours!==null && !openingHoursSchema.safeParse(hours).success){setError('Revisá los tramos: el inicio debe ser anterior al fin.');return}
    setBusy(true);setError(null)
    try{if(!await onSave(hours))setError('No se pudo guardar el horario.')}catch{setError('No se pudo guardar el horario. Revisá tu conexión.')}finally{setBusy(false)}
  }
  const rangesFor=(day:number,ranges:Array<[string,string]>)=>setHours(previous=>({...previous,[day]:ranges}))
  return <fieldset className="space-y-3" disabled={busy}>
    <legend className="font-medium">Horario de {name}</legend>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={hours===null} onChange={event=>setHours(event.target.checked?null:{})}/>Heredar horario de la tienda</label>
    {hours!==null && <>
      <p className="text-sm text-muted-foreground">Solo se ofrecen turnos dentro de este horario y del horario de la tienda. Sin días habilitados, no atiende online.</p>
      {[1,2,3,4,5,6,0].map(day=>{
        const ranges=hours[day]??[]
        return <div key={day} className="space-y-2 border-b pb-2">
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={ranges.length>0} onChange={event=>rangesFor(day,event.target.checked?[['08:00','18:00']]:[])}/>{WEEKDAY_LABELS[day]}</label>
          {ranges.map(([from,to],index)=><div key={index} className="flex flex-wrap items-center gap-2">
            <Input type="time" className="min-h-11 w-32 text-base" aria-label={`Inicio ${WEEKDAY_LABELS[day]} tramo ${index+1}`} value={from} onChange={event=>rangesFor(day,ranges.map((range,i)=>i===index?[event.target.value,range[1]]:range))}/>
            <Input type="time" className="min-h-11 w-32 text-base" aria-label={`Fin ${WEEKDAY_LABELS[day]} tramo ${index+1}`} value={to} onChange={event=>rangesFor(day,ranges.map((range,i)=>i===index?[range[0],event.target.value]:range))}/>
            <Button type="button" variant="ghost" className="min-h-11" onClick={()=>rangesFor(day,ranges.filter((_,i)=>i!==index))}>Quitar tramo</Button>
          </div>)}
          {ranges.length>0 && ranges.length<4 && <Button type="button" variant="outline" className="min-h-11" onClick={()=>rangesFor(day,[...ranges,['14:00','18:00']])}>Agregar tramo</Button>}
        </div>
      })}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" className="min-h-11" onClick={()=>void save()} disabled={busy}>{busy?'Guardando…':'Guardar horario'}</Button>
  </fieldset>
}
