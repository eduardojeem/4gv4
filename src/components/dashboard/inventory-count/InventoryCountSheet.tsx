'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Ban, CheckCheck, Download, Eye, EyeOff, Loader2, ScanBarcode, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { BarcodeScanner } from '@/components/ui/barcode-scanner'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import {
  COUNT_STATUS_LABELS,
  countDifference,
  countToCsv,
  findByCode,
  getInventoryCountDetailGuidance,
  parseScan,
  summarizeCount,
  type CountItem,
  type CountStatus,
} from '@/lib/inventory/inventory-count'
import { InventoryCountAssistant } from './InventoryCountAssistant'

type Relation = { name: string } | Array<{ name: string }> | null
const relationName = (value: Relation) => (Array.isArray(value) ? value[0]?.name : value?.name) ?? null

type CountHeader = {
  id: string
  number: number
  name: string
  status: CountStatus
  notes: string | null
  created_at: string
  applied_at: string | null
  branches: Relation
  categories: Relation
}

type Filter = 'all' | 'pending' | 'counted' | 'difference'
const PAGE = 150

function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-xs text-muted-foreground">—</span>
  if (diff === 0) return <span className="text-xs font-medium text-emerald-600">OK</span>
  return <span className={cn('font-semibold tabular-nums', diff > 0 ? 'text-blue-600' : 'text-red-600')}>{diff > 0 ? `+${diff}` : diff}</span>
}

export function InventoryCountSheet({ countId }: { countId: string }) {
  const router = useRouter()
  const [count, setCount] = useState<CountHeader | null>(null)
  const [items, setItems] = useState<CountItem[]>([])
  const [canAdjust, setCanAdjust] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [blind, setBlind] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [scan, setScan] = useState('')
  const [lastScan, setLastScan] = useState<{ name: string; qty: number; added: number } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const scanRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const response = await fetch(`/api/inventory-counts/${countId}`, { cache: 'no-store' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(body.error || 'No se encontró la toma')
      router.replace('/dashboard/inventory-count')
      return
    }
    setCount(body.count)
    setItems(body.items.map((item: CountItem) => ({ ...item, unit_cost: Number(item.unit_cost) })))
    setCanAdjust(Boolean(body.canAdjust))
    setLoading(false)
  }, [countId, router])
  useEffect(() => { void load() }, [load])

  const open = count?.status === 'counting'
  const editable = open && canAdjust
  const summary = useMemo(() => summarizeCount(items), [items])
  const guidance = useMemo(() => getInventoryCountDetailGuidance({
    status: count?.status ?? 'counting',
    canAdjust,
    counted: summary.counted,
    notCounted: summary.notCounted,
    withDifference: summary.withDifference,
  }), [count?.status, canAdjust, summary])

  const save = useCallback(async (updates: Array<{ item_id: string; counted_qty: number | null; match_system?: boolean }>) => {
    const previous = items
    // Optimista: el conteo se ve al instante; si falla, vuelve atrás.
    setItems((current) => current.map((item) => {
      const update = updates.find((candidate) => candidate.item_id === item.id)
      return update ? { ...item, counted_qty: update.counted_qty } : item
    }))
    const response = await fetch(`/api/inventory-counts/${countId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setItems(previous)
      toast.error(body.error || 'No se pudo guardar el conteo')
      return false
    }
    const saved = new Map((body.items as CountItem[]).map((item) => [item.id, item]))
    setItems((current) => current.map((item) => (saved.has(item.id) ? { ...item, ...saved.get(item.id)!, unit_cost: item.unit_cost } : item)))
    return true
  }, [countId, items])

  const commitDraft = (item: CountItem) => {
    const raw = drafts[item.id]
    if (raw === undefined) return
    setDrafts((current) => {
      const next = { ...current }
      delete next[item.id]
      return next
    })
    const value = raw.trim() === '' ? null : Math.max(0, Math.trunc(Number(raw)))
    if (value !== null && !Number.isFinite(value)) return
    if (value === item.counted_qty) return
    void save([{ item_id: item.id, counted_qty: value }])
  }

  /** Suma lo leído (lector, teclado o cámara). Devuelve el texto para la cámara, o null si no está en la toma. */
  const countCode = async (input: string, notify: boolean) => {
    const { code, quantity } = parseScan(input)
    if (!code) return undefined
    const item = findByCode(items, code)
    if (!item) {
      if (notify) toast.error(`No encontré el código «${code}» en esta toma`)
      return null
    }
    const next = (item.counted_qty ?? 0) + quantity
    if (!(await save([{ item_id: item.id, counted_qty: next }]))) return { text: `No se guardó ${item.name}`, ok: false }
    setLastScan({ name: item.name, qty: next, added: quantity })
    return `+${quantity} ${item.name} → llevás ${next}`
  }

  const onScan = async () => {
    const input = scan
    setScan('')
    await countCode(input, true)
    scanRef.current?.focus()
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      const diff = countDifference(item)
      if (filter === 'pending' && item.counted_qty !== null) return false
      if (filter === 'counted' && item.counted_qty === null) return false
      if (filter === 'difference' && (diff === null || diff === 0)) return false
      if (!term) return true
      return item.name.toLowerCase().includes(term) || (item.sku ?? '').toLowerCase().includes(term) || (item.barcode ?? '').includes(term)
    })
  }, [items, filter, search])

  const differences = useMemo(
    () => items.filter((item) => (countDifference(item) ?? 0) !== 0).sort((a, b) => Math.abs((countDifference(b) ?? 0) * b.unit_cost) - Math.abs((countDifference(a) ?? 0) * a.unit_cost)),
    [items],
  )

  const apply = async () => {
    setApplying(true)
    try {
      const response = await fetch(`/api/inventory-counts/${countId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply' }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo aplicar la toma')
        return
      }
      toast.success(`Stock ajustado en ${body.summary?.adjusted ?? 0} productos`)
      setReviewOpen(false)
      await load()
    } finally {
      setApplying(false)
    }
  }

  const cancel = async () => {
    if (!window.confirm('¿Anular esta toma? No se ajusta ningún stock.')) return
    const response = await fetch(`/api/inventory-counts/${countId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (!response.ok) {
      toast.error('No se pudo anular la toma')
      return
    }
    toast.success('Toma anulada')
    await load()
  }

  const exportCsv = () => {
    const blob = new Blob([`﻿${countToCsv(items)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `toma-inventario-${count?.number ?? ''}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const followGuidance = () => {
    if (guidance.kind === 'count') scanRef.current?.focus()
    else if (guidance.kind === 'continue') {
      setFilter('pending')
      setLimit(PAGE)
    } else if (guidance.kind === 'review') setReviewOpen(true)
  }

  if (loading || !count) {
    return <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando la toma…</p>
  }

  const showSystem = !blind || !open

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/dashboard/inventory-count" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Tomas de inventario</Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">#{count.number} · {count.name}</h1>
            <Badge variant="secondary" className="rounded-full">{COUNT_STATUS_LABELS[count.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[relationName(count.branches), relationName(count.categories) ? `Solo ${relationName(count.categories)}` : 'Todo el inventario', `abierta el ${new Date(count.created_at).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Exportar</Button>
          {editable && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void cancel()}><Ban className="h-4 w-4" /> Anular</Button>}
          {editable && (
            <Button size="sm" onClick={() => setReviewOpen(true)} disabled={summary.counted === 0}>
              <CheckCheck className="h-4 w-4" /> Revisar y aplicar
            </Button>
          )}
        </div>
      </div>

      <InventoryCountAssistant guidance={guidance} onAction={guidance.actionLabel ? followGuidance : undefined} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl"><CardContent className="space-y-2 p-4">
          <p className="text-xs font-medium text-muted-foreground">Avance</p>
          <p className="text-xl font-bold tabular-nums">{summary.counted} / {summary.total}</p>
          <Progress value={summary.progress} className="h-1.5" />
        </CardContent></Card>
        <Card className="rounded-xl"><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Con diferencia</p>
          <p className="text-xl font-bold tabular-nums">{showSystem ? summary.withDifference : '—'}</p>
          <p className="text-xs text-muted-foreground">{showSystem ? `+${summary.unitsIn} / −${summary.unitsOut} unidades` : 'Oculto mientras contás'}</p>
        </CardContent></Card>
        <Card className="rounded-xl"><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Diferencia valorizada (al costo)</p>
          <p className={cn('text-xl font-bold tabular-nums', showSystem && summary.valueDifference < 0 && 'text-red-600')}>{showSystem ? formatCurrency(summary.valueDifference) : '—'}</p>
        </CardContent></Card>
        <Card className="rounded-xl"><CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Sin contar</p>
          <p className="text-xl font-bold tabular-nums">{summary.notCounted}</p>
          <p className="text-xs text-muted-foreground">No se tocan al aplicar</p>
        </CardContent></Card>
      </div>

      {editable && (
        <Card className="rounded-xl border-primary/30">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                ref={scanRef}
                autoFocus
                value={scan}
                onChange={(event) => setScan(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void onScan() } }}
                placeholder="Escaneá o escribí el código y Enter (3*código suma 3)"
                className="h-11 pl-10 text-base"
                aria-label="Código para contar"
              />
            </div>
            {/* Con el celular: se cuenta recorriendo el depósito, un producto tras otro. */}
            <BarcodeScanner
              continuous
              label="Contar con la cámara"
              className="h-11 shrink-0"
              hint="Pasá cada unidad frente a la cámara: suma 1 por lectura"
              onScan={(code) => countCode(code, false)}
            />
            {lastScan && (
              <p className="text-sm sm:max-w-sm">
                <span className="font-semibold">+{lastScan.added}</span> {lastScan.name} <span className="text-muted-foreground">→ llevás {lastScan.qty}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {count.status === 'applied' && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Aplicada el {count.applied_at ? new Date(count.applied_at).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' }) : ''}. Cada ajuste quedó en los movimientos de stock con la referencia «Toma de inventario #{count.number}».
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {([
            ['all', `Todos (${summary.total})`],
            ['pending', `Sin contar (${summary.notCounted})`],
            ['counted', `Contados (${summary.counted})`],
            ...(showSystem ? [['difference', `Con diferencia (${summary.withDifference})`]] : []),
          ] as Array<[Filter, string]>).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setLimit(PAGE) }} className={cn('rounded-full border px-3 py-1 text-sm transition-colors', filter === value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <Button variant="outline" size="sm" onClick={() => { setBlind((value) => !value); if (filter === 'difference') setFilter('all') }} title="Contar sin ver lo que dice el sistema evita copiar el número">
              {blind ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {blind ? 'Mostrar sistema' : 'Conteo a ciegas'}
            </Button>
          )}
          <div className="relative w-full lg:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => { setSearch(event.target.value); setLimit(PAGE) }} placeholder="Buscar producto" className="pl-8" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Producto</th>
              {showSystem && <th className="w-24 p-3 text-right font-medium">Sistema</th>}
              <th className="w-32 p-3 font-medium">Contado</th>
              {showSystem && <th className="w-24 p-3 text-right font-medium">Diferencia</th>}
              {editable && showSystem && <th className="w-28 p-3" />}
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, limit).map((item) => {
              const diff = countDifference(item)
              const system = item.system_qty_at_count ?? item.system_qty
              return (
                <tr key={item.id} className={cn('border-b last:border-0', diff !== null && diff !== 0 && showSystem && 'bg-amber-50/50 dark:bg-amber-950/10')}>
                  <td className="p-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{[item.sku, item.barcode, item.category_name].filter(Boolean).join(' · ')}</p>
                  </td>
                  {showSystem && <td className="p-3 text-right tabular-nums text-muted-foreground">{system}</td>}
                  <td className="p-3">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="h-9 w-24"
                        aria-label={`Contado de ${item.name}`}
                        value={drafts[item.id] ?? (item.counted_qty ?? '')}
                        onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                        onBlur={() => commitDraft(item)}
                        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur() }}
                      />
                    ) : (
                      <span className="tabular-nums">{item.counted_qty ?? '—'}</span>
                    )}
                  </td>
                  {showSystem && <td className="p-3 text-right"><DiffBadge diff={count.status === 'applied' && item.applied_delta !== null ? item.applied_delta : diff} /></td>}
                  {editable && showSystem && (
                    <td className="p-3 text-right">
                      {item.counted_qty === null && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void save([{ item_id: item.id, counted_qty: system, match_system: true }])}>
                          Coincide
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No hay productos con este filtro.</p>}
        {visible.length > limit && (
          <div className="border-t p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit((value) => value + PAGE)}>Mostrar más ({visible.length - limit} restantes)</Button>
          </div>
        )}
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Revisar y aplicar la toma #{count.number}</DialogTitle>
            <DialogDescription>
              El stock de los productos contados pasa a lo que contaste. Cada cambio queda como movimiento de stock. Los {summary.notCounted} sin contar no se tocan.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-lg border p-2"><dt className="text-xs text-muted-foreground">Contados</dt><dd className="text-lg font-bold">{summary.counted}</dd></div>
            <div className="rounded-lg border p-2"><dt className="text-xs text-muted-foreground">A ajustar</dt><dd className="text-lg font-bold">{summary.withDifference}</dd></div>
            <div className="rounded-lg border p-2"><dt className="text-xs text-muted-foreground">Unidades</dt><dd className="text-lg font-bold"><span className="text-blue-600">+{summary.unitsIn}</span> <span className="text-red-600">−{summary.unitsOut}</span></dd></div>
            <div className="rounded-lg border p-2"><dt className="text-xs text-muted-foreground">Al costo</dt><dd className={cn('text-lg font-bold', summary.valueDifference < 0 && 'text-red-600')}>{formatCurrency(summary.valueDifference)}</dd></div>
          </dl>
          {differences.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {differences.slice(0, 50).map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="p-2">{item.name}</td>
                      <td className="p-2 text-right text-xs text-muted-foreground tabular-nums">{item.system_qty_at_count ?? item.system_qty} → {item.counted_qty}</td>
                      <td className="p-2 text-right"><DiffBadge diff={countDifference(item)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {differences.length > 50 && <p className="p-2 text-center text-xs text-muted-foreground">… y {differences.length - 50} más (están en el exportado)</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={applying}>Seguir contando</Button>
            <Button onClick={() => void apply()} disabled={applying}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Aplicar ajustes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
