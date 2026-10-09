'use client'
import type { AgendaProfessional } from '@/lib/agenda/agenda-server'
import { useCallback,useEffect,useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { utcToZoned,zonedToUtc } from '@/lib/agenda/time'
import { appointmentWhen } from '@/lib/agenda/messages'
export type TimeOffEditorProps={professionals:AgendaProfessional[];timeZone:string}
type Block={id:string;professional_id:string|null;starts_at:string;ends_at:string;reason:string|null}
type Conflict={id:string;customer_name:string;service_name:string;starts_at:string}
export function TimeOffEditor({professionals,timeZone}:TimeOffEditorProps){
  const [prof,setProf]=useState('all')
  const [start,setStart]=useState('')
  const [end,setEnd]=useState('')
  const [reason,setReason]=useState('')
  const [blocks,setBlocks]=useState<Block[]>([])
  const [preview,setPreview]=useState<{key:string;conflicts:Conflict[];total:number}|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const key=`${prof}|${start}|${end}`
  const current=preview?.key===key?preview:null
  const load=useCallback(async()=>{
    try{const response=await fetch('/api/agenda/time-off',{cache:'no-store'});const body=await response.json();if(!response.ok)throw new Error(body.error||'No se pudieron cargar las ausencias.');setBlocks(body.blocks??[])}catch(cause){setError(cause instanceof Error?cause.message:'No se pudieron cargar las ausencias.')}
  },[])
  useEffect(()=>{void load()},[load])
  const interval=()=>{
    const convert=(value:string)=>{
      if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Completá el inicio y el fin.')
      const date=value.slice(0,10),time=value.slice(11,16),stamp=zonedToUtc(date,time,timeZone),local=utcToZoned(stamp,timeZone)
      if(local.date!==date||local.time!==time)throw new Error('Ese horario no existe en la zona horaria de la tienda.')
      return new Date(stamp).toISOString()
    }
    const starts_at=convert(start),ends_at=convert(end)
    if(Date.parse(ends_at)<=Date.parse(starts_at))throw new Error('El fin debe ser posterior al inicio.')
    return {professional_id:prof==='all'?null:prof,starts_at,ends_at,reason:reason.trim()||null}
  }
  const inspect=async()=>{
    setBusy(true);setError(null)
    try{const row=interval();const params=new URLSearchParams({starts_at:row.starts_at,ends_at:row.ends_at});if(row.professional_id)params.set('professional_id',row.professional_id)
      const response=await fetch('/api/agenda/time-off?'+params);const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'No se pudieron revisar los turnos.');setPreview({key,conflicts:body.conflicts??[],total:body.total??0})
    }catch(cause){setError(cause instanceof Error?cause.message:'No se pudieron revisar los turnos.')}finally{setBusy(false)}
  }
  const save=async()=>{
    if(!current || current.total>0)return
    setBusy(true);setError(null)
    try{const response=await fetch('/api/agenda/time-off',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(interval())});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'No se pudo guardar la ausencia.')
      setPreview(null);setStart('');setEnd('');setReason('');await load()
    }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo guardar la ausencia.');setPreview(null)}finally{setBusy(false)}
  }
  const remove=async(id:string)=>{
    if(!window.confirm('¿Quitar esta ausencia y volver a ofrecer el horario?'))return
    setBusy(true);setError(null)
    try{const response=await fetch('/api/agenda/time-off',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'No se pudo quitar la ausencia.');await load();setPreview(null)}catch(cause){setError(cause instanceof Error?cause.message:'No se pudo quitar la ausencia.')}finally{setBusy(false)}
  }
  return <section className="space-y-3">
    <h2 className="text-base font-semibold">Pausas y ausencias</h2>
    <p className="text-sm text-muted-foreground">Vacaciones, almuerzo o cierre excepcional. Primero revisá los turnos afectados. No se cancelan ni se mueven automáticamente. Zona: {timeZone}.</p>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block space-y-1 text-sm">A quién afecta<select value={prof} onChange={event=>setProf(event.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3 text-base"><option value="all">Toda la tienda</option>{professionals.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Inicio de la ausencia<Input type="datetime-local" className="min-h-11 text-base" value={start} onChange={event=>setStart(event.target.value)} /></label>
        <label className="space-y-1 text-sm">Fin de la ausencia<Input type="datetime-local" className="min-h-11 text-base" value={end} onChange={event=>setEnd(event.target.value)} /></label>
      </div>
      <label className="block space-y-1 text-sm">Motivo (opcional)<Input className="min-h-11 text-base" maxLength={300} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" onClick={()=>void inspect()} disabled={busy||!start||!end}>Revisar turnos afectados</Button>
        <Button type="button" className="min-h-11" onClick={()=>void save()} disabled={busy||!current||current.total>0}>Guardar ausencia</Button></div>
    </fieldset>
    {current && (current.total>0?<div role="alert" className="space-y-2 rounded-md border p-3 text-sm"><p>Hay {current.total} turno(s) en conflicto. Reprogramalos antes de crear la ausencia.</p><ul>{current.conflicts.map(row=><li key={row.id}>{row.customer_name} · {row.service_name} · {appointmentWhen(row.starts_at,timeZone)}</li>)}</ul></div>:<p role="status" className="text-sm">No hay turnos afectados. Al guardar se vuelve a comprobar.</p>)}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {blocks.length===0?<p className="text-sm text-muted-foreground">No hay ausencias próximas.</p>:<ul className="divide-y">{blocks.map(block=><li key={block.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{professionals.find(p=>p.id===block.professional_id)?.name??'Toda la tienda'} · {appointmentWhen(block.starts_at,timeZone)} → {appointmentWhen(block.ends_at,timeZone)}{block.reason&&` · ${block.reason}`}</span><Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={()=>void remove(block.id)}>Quitar ausencia</Button></li>)}</ul>}
  </section>
}
