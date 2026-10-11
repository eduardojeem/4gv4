'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { type SuggestedService } from '@/lib/agenda/suggested-services'
import { createAgendaService, serviceCreationDefinitelyRejected, type AgendaServiceCreateInput } from '@/lib/agenda/service-creation'

interface Row { name: string; checked: boolean; price: string; duration: string; completed: boolean }
const newRow = (name: string): Row => ({ name, checked: true, price: '', duration: '', completed: false })

export function SuggestedServicesCard({ suggestions, currency, rubroLabel, onAdded }: {
  suggestions: SuggestedService[]; currency: string; rubroLabel: string; onAdded: () => Promise<void> | void
}) {
  const [rows, setRows] = useState<Row[]>(() => suggestions.map(service => newRow(service.name)))
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const pending = useRef(false)
  const attempts = useRef(new Map<string, AgendaServiceCreateInput>())
  const uncertain = useRef(new Set<string>())
  // Preserve pending drafts and completed markers on catalog refresh.
  useEffect(() => {
    setRows(current => [...current, ...suggestions.filter(service => !current.some(row => row.name === service.name)).map(service => newRow(service.name))])
  }, [suggestions])
  const update = (index: number, patch: Partial<Row>) => setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row))
  const priceOf = (row: Row) => Number(currency === 'PYG' ? row.price.replace(/[.\s]/g, '') : row.price.replace(',', '.'))
  const selected = rows.filter(row => row.checked && !row.completed)
  const missingPrice = selected.some(row => row.price.trim() === '' || !Number.isFinite(priceOf(row)) || priceOf(row) < 0 || priceOf(row) > 99999999.99 || Math.abs(priceOf(row) * 100 - Math.round(priceOf(row) * 100)) >= 0.000001)
  const missingDuration = selected.some(row => !Number.isInteger(Number(row.duration)) || Number(row.duration) < 5 || Number(row.duration) > 600)

  const add = async () => {
    if (pending.current || !selected.length || missingPrice || missingDuration) return
    pending.current = true
    setAdding(true)
    let completed = 0
    try {
      for (const row of selected) {
        let input = attempts.current.get(row.name)
        if (!input) {
          input = { requestKey: crypto.randomUUID(), name: row.name, price: priceOf(row), durationMinutes: Number(row.duration), catalogVisible: true, online: true }
          attempts.current.set(row.name, input)
        }
        await createAgendaService(input)
        completed++
        setRows(current => current.map(item => item.name === row.name ? { ...item, completed: true, checked: false } : item))
      }
      setNotice(`${completed} servicio(s) agregado(s).`)
      toast.success(`${completed} servicio(s) agregado(s).`)
    } catch (error) {
      const failedName = selected[completed].name
      if (serviceCreationDefinitelyRejected(error) && !uncertain.current.has(failedName)) attempts.current.delete(failedName)
      else uncertain.current.add(failedName)
      setNotice(`${completed} creado(s) en este intento; ${selected.length - completed} pendiente(s). Reintentá sin duplicar los completados.`)
      toast.error(error instanceof Error ? error.message : 'No se pudo confirmar el alta. Conservamos los pendientes.')
    } finally {
      if (completed > 0) await Promise.resolve().then(onAdded).catch(() => toast.warning('Los servicios están creados. Recargá la lista para verlos.'))
      pending.current = false
      setAdding(false)
    }
  }
  if (rows.length === 0) return null
  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div><p className="text-sm font-semibold">Servicios típicos de {rubroLabel}</p><p className="text-xs text-muted-foreground">Elegí los que ofrecés y completá tus precios ({currency}) y minutos reales. Se publican en catálogo y reservas online; después podés ajustar cada servicio.</p></div>
      </div>
      <ul className="space-y-2">
        {rows.map((row, index) => {
          const locked = adding || row.completed || attempts.current.has(row.name)
          return <li key={row.name} className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex min-w-0 flex-1 items-center gap-2"><Checkbox disabled={adding || row.completed} checked={row.checked} onCheckedChange={checked => update(index, { checked: checked === true })} aria-label={`Agregar ${row.name}`} /><span>{row.name}{row.completed ? ' · Creado' : ''}</span></label>
            <Input type="number" min={0} inputMode="decimal" className="min-h-10 w-28" value={row.price} placeholder="Precio" aria-label={`Precio de ${row.name}`} disabled={!row.checked || locked} onChange={event => update(index, { price: event.target.value })} />
            <span className="flex items-center gap-1"><Input type="number" min={5} max={600} step={1} inputMode="numeric" className="min-h-10 w-20" value={row.duration} aria-label={`Duración de ${row.name}`} disabled={!row.checked || locked} onChange={event => update(index, { duration: event.target.value })} /><span className="text-xs text-muted-foreground">min</span></span>
          </li>
        })}
      </ul>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{missingPrice ? `Completá el precio (${currency}) de los marcados.` : `${selected.length} seleccionados`}</p>
        {missingDuration && <p className="text-xs text-muted-foreground">Completá la duración de cada servicio (5–600 minutos).</p>}
        <Button size="sm" onClick={() => void add()} disabled={adding || selected.length === 0 || missingPrice || missingDuration}>{adding && <Loader2 className="h-4 w-4 animate-spin" />}Agregar servicios</Button>
      </div>
    </div>
  )
}
