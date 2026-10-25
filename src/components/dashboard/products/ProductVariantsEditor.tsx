'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { useOptionalBranch } from '@/contexts/branch-context'
import type { BusinessVertical } from '@/lib/organization/business-profile'
import { generateVariantCombinations, mergeGeneratedVariants, type VariantPriceDefaults } from '@/lib/products/variant-combinations'
import type { ProductAttributeDefinition, ProductVariantInput, ProductVariantsPayload } from '@/lib/products/variant-contract'
import { analyzeVariantRemovalImpact, type VariantRemovalImpact } from '@/lib/products/variant-safety'
import { countVariantCombinations, validateVariantAttributes, VARIANT_COMBINATION_WARNING_THRESHOLD, VARIANT_COMBINATION_HARD_CAP } from '@/lib/products/variant-workflow'
import { previewVariantCombinations } from '@/lib/products/variant-editor-model'
import { variantSelectionKey } from '@/lib/products/variant-bulk'
import { getVerticalAttributeSuggestions } from '@/lib/products/vertical-attributes'
import { mergeAttributeSuggestions, type SavedAttribute } from '@/lib/inventory/variant-sync'
import { VariantAttributeBuilder } from './variants/VariantAttributeBuilder'
import { VariantEditableGrid } from './variants/VariantEditableGrid'
import { VariantBulkToolbar } from './variants/VariantBulkToolbar'
import { VariantImpactDialog } from './variants/VariantImpactDialog'

export interface ProductVariantsEditorProps {
 value: ProductVariantsPayload
 onChange: (value: ProductVariantsPayload) => void
 basePrices: VariantPriceDefaults
 baseSku?: string
 businessVertical: BusinessVertical
 disabled?: boolean
 canViewCost?: boolean
 canUpdateCost?: boolean
 branchContext?: {id: string; name: string} | null
}
type VariantPreset = {
  id: string
  title: string
  description: string
  skuPrefix: string
  recommendedFor: BusinessVertical[]
  attributes: ProductAttributeDefinition[]
}

const VARIANT_PRESETS: VariantPreset[] = [
  {
    id: 'shirt', title: 'Remera clásica', description: 'Talles S a XL y dos colores', skuPrefix: 'REM',
    recommendedFor: ['clothing'],
    attributes: [
      { key: 'size', label: 'Talle', control: 'select', options: ['S', 'M', 'L', 'XL'] },
      { key: 'color', label: 'Color', control: 'color', options: ['Negro', 'Blanco'] },
    ],
  },
  {
    id: 'sports-shirt', title: 'Remera deportiva', description: 'Cinco talles y tres colores', skuPrefix: 'SPORT',
    recommendedFor: ['clothing'],
    attributes: [
      { key: 'size', label: 'Talle', control: 'select', options: ['XS', 'S', 'M', 'L', 'XL'] },
      { key: 'color', label: 'Color', control: 'color', options: ['Negro', 'Blanco', 'Azul'] },
    ],
  },
  {
    id: 'footwear', title: 'Calzado', description: 'Numeración y color', skuPrefix: 'CAL',
    recommendedFor: ['clothing'],
    attributes: [
      { key: 'size', label: 'Número', control: 'select', options: ['35', '36', '37', '38', '39', '40', '41', '42'] },
      { key: 'color', label: 'Color', control: 'color', options: ['Negro', 'Blanco'] },
    ],
  },
  {
    id: 'cosmetics', title: 'Cosmética', description: 'Tono y presentación', skuPrefix: 'COS',
    recommendedFor: ['cosmetics'],
    attributes: [
      { key: 'tone', label: 'Tono', control: 'color', options: ['Claro', 'Medio', 'Oscuro'] },
      { key: 'volume', label: 'Volumen', control: 'select', options: ['30 ml', '50 ml'] },
    ],
  },
  {
    id: 'electronics', title: 'Electrónica', description: 'Capacidad y color', skuPrefix: 'TEC',
    recommendedFor: ['electronics'],
    attributes: [
      { key: 'capacity', label: 'Capacidad', control: 'select', options: ['128 GB', '256 GB'] },
      { key: 'color', label: 'Color', control: 'color', options: ['Negro', 'Plata'] },
    ],
  },
  {
    id: 'presentation', title: 'Presentaciones', description: 'Tamaño o contenido', skuPrefix: 'PRES',
    recommendedFor: ['food', 'hardware', 'general', 'other'],
    attributes: [
      { key: 'presentation', label: 'Presentación', control: 'select', options: ['Pequeño', 'Mediano', 'Grande'] },
    ],
  },
]

export function ProductVariantsEditor({ value, onChange, basePrices, baseSku = 'VAR', businessVertical, disabled = false, canViewCost = true, canUpdateCost = true, branchContext }: ProductVariantsEditorProps) {
  const branchScope = useOptionalBranch()
  const branch = branchContext !== undefined ? branchContext : branchScope?.selectedBranch && branchScope.selectedBranch.id === branchScope.selectedBranchId ? { id: branchScope.selectedBranch.id, name: branchScope.selectedBranch.name } : null
  const [savedAttributes, setSavedAttributes] = useState<SavedAttribute[]>([])
  const [impact, setImpact] = useState<VariantRemovalImpact | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [largeOpen, setLargeOpen] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const reviewRef = useRef<HTMLDivElement>(null)
  const [originals, setOriginals] = useState(() => new Map(value.variants.flatMap(v => v.id ? [[v.id, JSON.stringify(v)] as const] : [])))
  useEffect(() => {
    if (!value.hasVariants) return
    let cancelled = false
    fetch('/api/attributes', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(body => { if (!cancelled && Array.isArray(body?.data)) setSavedAttributes(body.data) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [value.hasVariants])
  const preview = useMemo(() => previewVariantCombinations(value.attributes, value.variants), [value.attributes, value.variants])
  const request = (next: ProductVariantsPayload, reason: string) => {
    const result = analyzeVariantRemovalImpact(value.variants, next.variants, reason)
    if (result.requiresReview) { setImpact(result); return }
    setOriginals(old => {
      const nextOriginals = new Map(old)
      value.variants.forEach(v => { if (v.id && !nextOriginals.has(v.id)) nextOriginals.set(v.id, JSON.stringify(v)) })
      return nextOriginals
    })
    setSelected(old => new Set([...old].filter(key => next.variants.some(v => variantSelectionKey(v) === key))))
    setError(''); onChange(next)
  }
  const attributesChange = (attributes: ProductAttributeDefinition[]) => {
    const result = previewVariantCombinations(attributes, value.variants).impact
    if (result.requiresReview) { setImpact(result); return }
    setError(''); onChange({ ...value, attributes })
  }
  const generate = (confirmed = false) => {
    const errors = validateVariantAttributes(value.attributes)
    if (errors.length) { setError(errors[0]); return }
    const count = countVariantCombinations(value.attributes)
    if (count > VARIANT_COMBINATION_HARD_CAP) { setError(`El máximo es ${VARIANT_COMBINATION_HARD_CAP} combinaciones por operación. Reducí los valores.`); return }
    if (count > VARIANT_COMBINATION_WARNING_THRESHOLD && !confirmed) { setLargeOpen(true); return }
    const variants = mergeGeneratedVariants(generateVariantCombinations(value.attributes), value.variants, basePrices).map((v, i) => ({ ...v, sku: v.sku || `${baseSku.trim().toUpperCase() || 'VAR'}-${String(i + 1).padStart(2, '0')}` }))
    setLargeOpen(false); request({ ...value, variants }, 'regenerate')
  }
  const applyPreset = (preset: VariantPreset) => {
    if ((value.attributes.length || value.variants.length) && !window.confirm(`La plantilla ${preset.title} reemplazará la configuración. Los datos de combinaciones existentes se conservarán. ¿Querés continuar?`)) return
    const attributes = preset.attributes.map(a => ({ ...a, options: [...a.options] }))
    const variants = mergeGeneratedVariants(generateVariantCombinations(attributes), value.variants, basePrices).map((v, i) => ({ ...v, sku: v.sku || `${baseSku.trim().toUpperCase() || preset.skuPrefix}-${String(i + 1).padStart(2, '0')}` }))
    request({ hasVariants: true, attributes, variants }, 'preset')
  }
  const update = (index: number, patch: Partial<ProductVariantInput>) => request({ ...value, variants: value.variants.map((v, i) => i === index ? { ...v, ...patch } : v) }, 'edit')
  const rows = value.variants.map((variant, index) => ({ variant, index, state: !variant.id ? 'new' as const : originals.has(variant.id) && originals.get(variant.id) !== JSON.stringify(variant) ? 'modified' as const : 'unchanged' as const })).filter(({ variant: v }) => {
    const match = `${v.name} ${v.sku} ${Object.values(v.attributes).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())
    return match && (filter === 'all' || filter === 'active' && v.isActive || filter === 'inactive' && !v.isActive || filter === 'stock' && v.stockQuantity > 0 || filter === 'empty' && v.stockQuantity <= 0)
  })
  const suggestions = mergeAttributeSuggestions(savedAttributes, getVerticalAttributeSuggestions(businessVertical))
  return <section aria-labelledby="product-variants-title" className="space-y-5">
    <div className="flex flex-col gap-4 rounded-2xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="max-w-xl"><h3 id="product-variants-title" className="text-lg font-semibold tracking-tight">Variantes</h3><p className="mt-1 text-sm text-muted-foreground">Creá opciones como color, memoria o talle y generá las combinaciones automáticamente.</p></div><div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl border bg-background p-1"><Button type="button" size="sm" variant={!value.hasVariants ? 'default' : 'ghost'} disabled={disabled} onClick={() => request({ hasVariants: false, attributes: [], variants: [] }, 'simple')}>Producto simple</Button><Button type="button" size="sm" aria-label="Producto con variantes" variant={value.hasVariants ? 'default' : 'ghost'} disabled={disabled} onClick={() => onChange({ ...value, hasVariants: true })}>Con variantes</Button></div></div>
    <details open className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">Empezá con una plantilla</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...VARIANT_PRESETS].sort((a, b) => Number(b.recommendedFor.includes(businessVertical)) - Number(a.recommendedFor.includes(businessVertical))).map(p => <Button key={p.id} type="button" variant="outline" className="h-auto justify-start whitespace-normal p-3 text-left" aria-label={p.id === 'shirt' ? 'Configurar una remera' : `Usar plantilla ${p.title}`} disabled={disabled} onClick={() => applyPreset(p)}><span><strong className="block">{p.title}</strong><span className="text-xs font-normal text-muted-foreground">{p.description}</span></span></Button>)}</div></details>
    <div><button type="button" aria-expanded={showGuide} onClick={() => setShowGuide(!showGuide)} className="text-xs font-medium text-muted-foreground underline underline-offset-4">¿Cómo funcionan las variantes?</button>{showGuide && <p className="mt-2 rounded-lg bg-muted p-3 text-sm">Multiplicación automática: 2 colores × 2 memorias = 4 combinaciones. Cada una conserva su SKU, precio, costo y stock.</p>}</div>
    {value.hasVariants && <>
      <div className="flex flex-wrap gap-2">{suggestions.map(s => <Button key={s.key} type="button" size="sm" variant="outline" disabled={disabled || value.attributes.some(a => a.key === s.key)} onClick={() => attributesChange([...value.attributes, { key: s.key, label: s.label, control: s.control, options: [...s.examples] }])}>+ {s.label}</Button>)}</div>
      <VariantAttributeBuilder attributes={value.attributes} onChange={attributesChange} disabled={disabled} />
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{preview.count} combinaciones posibles</p><p className="mt-1 text-xs text-muted-foreground">{value.attributes.map(a => `${a.label}: ${a.options.length}`).join(' · ')}</p><div className="mt-2 flex flex-wrap gap-2 text-xs"><Badge variant="secondary">{preview.newCount} nuevas</Badge><Badge variant="outline">{preview.preservedCount} existentes se conservarán</Badge>{preview.impact.requiresReview && <Badge variant="outline">{preview.impact.variantsAffected} requieren revisión</Badge>}</div></div><Button type="button" disabled={disabled || !preview.count || preview.count > VARIANT_COMBINATION_HARD_CAP} onClick={() => generate()}>{value.variants.length ? 'Regenerar combinaciones' : 'Generar combinaciones'}</Button></div>
      {preview.count > VARIANT_COMBINATION_HARD_CAP && <p role="alert" className="text-sm text-destructive">Reducí la combinación de atributos: el máximo es {VARIANT_COMBINATION_HARD_CAP} variantes por operación.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {value.variants.length > 0 ? <div ref={reviewRef} tabIndex={-1} aria-label="Variantes para revisar" className="space-y-3 outline-none">
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Ajustá las combinaciones <span className="text-muted-foreground">({value.variants.length})</span></h4><p className="text-xs text-muted-foreground">{branch ? `Sucursal: ${branch.name}` : 'Seleccioná una sucursal para asignar stock.'}</p></div>
        {value.variants.length >= 8 && <div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Buscar variantes" placeholder="Buscar SKU o atributos" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filtrar variantes" value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border bg-background p-2 text-sm"><option value="all">Todas</option><option value="active">Activas</option><option value="inactive">Inactivas</option><option value="stock">Con stock</option><option value="empty">Sin stock</option></select></div>}
        <VariantBulkToolbar variants={value.variants} selected={selected} onApply={variants => request({ ...value, variants }, 'bulk')} onClear={() => setSelected(new Set())} canUpdateCost={canViewCost && canUpdateCost} branch={branch} baseSku={baseSku} disabled={disabled} />
        <VariantEditableGrid rows={rows} selectedKeys={selected} onToggle={key => setSelected(old => { const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next })} onToggleAll={() => setSelected(old => { const next = new Set(old); const all = rows.every(r => next.has(variantSelectionKey(r.variant))); rows.forEach(r => { const key = variantSelectionKey(r.variant); if (all) next.delete(key); else next.add(key) }); return next })} onUpdate={update} onRemove={index => request({ ...value, variants: value.variants.filter((_, i) => index !== i) }, 'remove-variant')} canViewCost={canViewCost} canUpdateCost={canUpdateCost} disabled={disabled} stockEditable={Boolean(branch)} branchName={branch?.name} />
        {!rows.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No hay variantes con estos filtros.</p>}
      </div> : <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Agregá atributos y generá las combinaciones para comenzar.</div>}
    </>}
    <VariantImpactDialog impact={impact} onClose={() => setImpact(null)} onReview={() => { setImpact(null); reviewRef.current?.focus(); reviewRef.current?.scrollIntoView?.({ block: 'nearest' }) }} />
    <AlertDialog open={largeOpen} onOpenChange={setLargeOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Generar {preview.count} variantes</AlertDialogTitle><AlertDialogDescription>Esta combinación supera {VARIANT_COMBINATION_WARNING_THRESHOLD} variantes. Revisá los atributos antes de continuar. Se conservarán las combinaciones existentes.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => generate(true)}>Generar variantes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>
}
