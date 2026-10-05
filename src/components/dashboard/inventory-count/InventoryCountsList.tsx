'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ClipboardCheck, Loader2, Plus, RefreshCw, ScanBarcode } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useBranch } from '@/contexts/branch-context'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { COUNT_STATUS_LABELS, type CountStatus } from '@/lib/inventory/inventory-count'
import { getInventoryCountListGuidance } from '@/lib/inventory/inventory-count'
import { InventoryCountAssistant } from './InventoryCountAssistant'

type Relation = { name: string } | Array<{ name: string }> | null
const relationName = (value: Relation) => (Array.isArray(value) ? value[0]?.name : value?.name) ?? null

type CountRow = {
  id: string
  number: number
  name: string
  status: CountStatus
  branch_id: string
  created_at: string
  applied_at: string | null
  summary: { counted?: number; adjusted?: number; units_in?: number; units_out?: number; value_difference?: number; not_counted?: number }
  branches: Relation
  categories: Relation
}

const STATUS_STYLES: Record<CountStatus, string> = {
  counting: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  applied: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800',
}

const ALL = '__all__'

function NewCountDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const { branches, selectedBranchId } = useBranch()
  const [branchId, setBranchId] = useState('')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(ALL)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const effectiveBranch = branchId || selectedBranchId || branches[0]?.id || ''
  const defaultName = `Toma del ${new Date().toLocaleDateString('es-PY')}`

  const create = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/inventory-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: effectiveBranch,
          name: name.trim() || defaultName,
          category_id: categoryId === ALL ? null : categoryId,
          notes: notes.trim() || null,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo abrir la toma')
        if (body.countId) router.push(`/dashboard/inventory-count/${body.countId}`)
        return
      }
      toast.success(`Toma #${body.count.number} abierta con ${body.items} productos`)
      router.push(`/dashboard/inventory-count/${body.count.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva toma de inventario</DialogTitle>
          <DialogDescription>
            Se guarda el stock que el sistema tiene ahora en la sucursal. Podés seguir vendiendo mientras contás: lo que se venda en el medio no cuenta como faltante.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="count-name" className="text-xs">Nombre</Label>
            <Input id="count-name" value={name} placeholder={defaultName} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Sucursal</Label>
              <Select value={effectiveBranch} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="Elegí la sucursal" /></SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Qué contar</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todo el inventario</SelectItem>
                  {categories.map((category) => <SelectItem key={category.id} value={category.id}>Solo {category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="count-notes" className="text-xs">Notas (opcional)</Label>
            <Textarea id="count-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Quién cuenta, qué sector…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void create()} disabled={saving || !effectiveBranch}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} Abrir toma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function InventoryCountsList() {
  const router = useRouter()
  const [counts, setCounts] = useState<CountRow[]>([])
  const [progress, setProgress] = useState<Record<string, { total: number; counted: number }>>({})
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [available, setAvailable] = useState(true)
  const [canAdjust, setCanAdjust] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/inventory-counts', { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      setAvailable(body.available !== false)
      setCounts(Array.isArray(body.counts) ? body.counts : [])
      setProgress(body.progress ?? {})
      setCategories(Array.isArray(body.categories) ? body.categories : [])
      setCanAdjust(Boolean(body.canAdjust))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const guidance = useMemo(() => getInventoryCountListGuidance({ available, canAdjust, counts, progress }), [available, canAdjust, counts, progress])
  const followGuidance = () => {
    if (guidance.kind === 'start') setDialogOpen(true)
    else if (guidance.countId) router.push(`/dashboard/inventory-count/${guidance.countId}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Toma de inventario</h1>
          <p className="mt-1 text-sm text-muted-foreground">Contá lo que hay en el local, mirá las diferencias con el sistema y ajustá el stock dejando registro de cada cambio.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Actualizar
          </Button>
          {canAdjust && <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!available}><Plus className="h-4 w-4" /> Nueva toma</Button>}
        </div>
      </div>

      {!loading && <InventoryCountAssistant guidance={guidance} onAction={guidance.actionLabel ? followGuidance : undefined} />}

      {!available && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          La toma de inventario todavía no está activada en la base de datos. Pedile al administrador de la plataforma que aplique la actualización.
        </p>
      )}

      {loading && counts.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
      ) : counts.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
            <ScanBarcode className="h-10 w-10" />
            <p className="max-w-md">Todavía no hiciste ninguna toma. Abrí una, contá con el lector de códigos o a mano, y al final aplicá los ajustes: cada diferencia queda como movimiento de stock.</p>
            {canAdjust && available && <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Abrir la primera toma</Button>}
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {counts.map((count) => {
            const open = count.status === 'counting'
            const p = progress[count.id]
            const percent = p?.total ? Math.round((p.counted / p.total) * 100) : 0
            return (
              <li key={count.id}>
                <Link href={`/dashboard/inventory-count/${count.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 transition-colors hover:bg-muted/50">
                  <span className="w-12 font-mono text-sm font-semibold">#{count.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{count.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[relationName(count.branches), relationName(count.categories) ? `Solo ${relationName(count.categories)}` : 'Todo el inventario', new Date(count.created_at).toLocaleDateString('es-PY')].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {open && p ? (
                    <span className="flex w-40 items-center gap-2 text-xs text-muted-foreground">
                      <Progress value={percent} className="h-1.5" /> {p.counted}/{p.total}
                    </span>
                  ) : count.status === 'applied' ? (
                    <span className="text-xs text-muted-foreground">
                      {count.summary.adjusted ?? 0} ajustes
                      {Number(count.summary.value_difference) ? ` · ${formatCurrency(Number(count.summary.value_difference))}` : ''}
                    </span>
                  ) : null}
                  <Badge variant="secondary" className={cn('rounded-full', STATUS_STYLES[count.status])}>{COUNT_STATUS_LABELS[count.status]}</Badge>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <NewCountDialog open={dialogOpen} onOpenChange={setDialogOpen} categories={categories} />
    </div>
  )
}
