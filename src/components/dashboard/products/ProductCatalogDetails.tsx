'use client'
import { useEffect, useRef, useState, useId } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useProductCatalogDetails } from '@/hooks/use-product-catalog-details'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { useAuth } from '@/contexts/auth-context'
import type { BusinessVertical } from '@/lib/organization/business-profile'
import { catalogFieldsFor, catalogDetailRows } from '@/lib/products/catalog-fields'
import { cleanProductDetails, type ProductDetails } from '@/lib/products/catalog-contract'
import { ProductExpirySummary } from './ProductExpirySummary'
import { toast } from 'sonner'
type FieldProps = { vertical: BusinessVertical; value: ProductDetails; onChange: (value: ProductDetails) => void; disabled?: boolean; variantKeys?: string[] }

export function CatalogDetailFields({ vertical, value, onChange, disabled, variantKeys = [] }: FieldProps) {
  const id = useId()
  const update = (key: keyof ProductDetails, val: string | number | undefined) => onChange({ ...value, [key]: val })
  return <div className="grid gap-3 sm:grid-cols-2">{catalogFieldsFor(vertical).filter(field => !variantKeys.includes(field.key)).map(field => <div key={field.key} className={field.multiline ? 'space-y-1 sm:col-span-2' : 'space-y-1'}><label htmlFor={`${id}-${field.key}`} className="text-xs font-medium">{field.label}</label>{field.multiline ? <Textarea id={`${id}-${field.key}`} disabled={disabled} value={String(value[field.key] ?? '')} onChange={e => update(field.key, e.target.value)} placeholder={field.example} maxLength={1000} rows={2} /> : <Input id={`${id}-${field.key}`} disabled={disabled} value={String(value[field.key] ?? '')} onChange={e => update(field.key, e.target.value)} placeholder={field.example} maxLength={120} />}</div>)}
    {['cosmetics', 'barbershop', 'beauty_services'].includes(vertical) && <div className="space-y-1 sm:col-span-2"><label htmlFor={`${id}-pao`} className="text-xs font-medium">Uso después de abrir (PAO, meses)</label><Input id={`${id}-pao`} type="number" min={1} max={120} step={1} disabled={disabled} value={value.pao_months ?? ''} onChange={e => update('pao_months', e.target.value ? Number(e.target.value) : undefined)} placeholder="Ej.: 12, solo si figura en el envase" /><p className="text-xs text-muted-foreground">Se cuenta desde que se abre cada envase. No reemplaza el vencimiento impreso ni es una fecha de lote.</p></div>}
    {['cosmetics', 'food', 'barbershop', 'beauty_services'].includes(vertical) && <div className="space-y-1 sm:col-span-2">
      <label htmlFor={`${id}-expiry`} className="text-xs font-medium">Control de vencimiento</label>
      <select id={`${id}-expiry`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" disabled={disabled} value={value.expiry_policy ?? 'unspecified'} onChange={e => onChange({ ...value, expiry_policy: e.target.value as ProductDetails['expiry_policy'] })}>
        <option value="unspecified">Sin dato cargado</option><option value="tracked">Registrar vencimientos por lote</option><option value="not_applicable">No corresponde a este producto</option>
      </select><p className="text-xs text-muted-foreground">Elegí según el envase. No tener una fecha cargada no significa que el producto no venza.</p>
    </div>}
  </div>
}

export function ProductCatalogDetailsForm({ productId, vertical, value, onChange, disabled, variantKeys }: FieldProps & { productId?: string }) {
  const { scope } = useTenantScope()
  if (productId) return <ExistingCatalogEditor key={`${scope}:${productId}`} productId={productId} vertical={vertical} />
  return <NewCatalogEditor vertical={vertical} value={value} onChange={onChange} disabled={disabled} variantKeys={variantKeys} />
}

function NewCatalogEditor({ vertical, value, onChange, disabled, variantKeys }: FieldProps) {
  const data = useProductCatalogDetails()
  return <section className="space-y-3 rounded-xl border bg-background p-4"><h3 className="text-sm font-semibold">Características del producto</h3><p className="text-xs leading-relaxed text-muted-foreground">Opcionales. Describen este producto, sin generar nuevas combinaciones ni modificar stock. Los tonos o tamaños con precios y stock propios van en Variantes.</p>{data.loading ? <p role="status" className="text-xs">Consultando disponibilidad…</p> : data.error ? <p role="alert" className="text-xs">{data.error} <Button type="button" variant="link" size="sm" onClick={data.reload}>Reintentar</Button></p> : !data.available ? <p className="text-xs text-muted-foreground">Falta activar la migración de características. Podés completar el resto del producto; estos campos estarán disponibles después de activarla.</p> : <CatalogDetailFields vertical={vertical} value={value} onChange={onChange} disabled={disabled} variantKeys={variantKeys} />}</section>
}

function ExistingCatalogEditor({ productId, vertical }: { productId: string; vertical: BusinessVertical }) {
  const data = useProductCatalogDetails(productId)
  const { scope, currentScope } = useTenantScope()
  const { hasPermission } = useAuth()
  const [draft, setDraft] = useState<ProductDetails | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const value = draft ?? data.details
  const save = async () => {
    if (saving || !hasPermission('products.update')) return
    setSaving(true); setError(null)
    try {
      const response = await fetch('/api/products/catalog-details', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: productId, details: cleanProductDetails(value) }) })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.error || 'No se pudieron guardar las características.')
      if (!alive.current || currentScope.current !== scope) return
      setDraft(body.details); toast.success('Características guardadas.')
      window.dispatchEvent(new CustomEvent('catalog-details:changed', { detail: { productId } }))
    } catch (e) { if (alive.current && currentScope.current === scope) setError(e instanceof Error ? e.message : 'No se pudieron guardar las características.') }
    finally { if (alive.current && currentScope.current === scope) setSaving(false) }
  }
  return <section className="space-y-3 rounded-xl border p-4"><h3 className="text-sm font-semibold">Características del producto</h3><p className="text-xs text-muted-foreground">Estas características se guardan con su propio botón, por separado del resto del formulario.</p>{data.loading ? <p role="status" className="text-xs">Cargando características…</p> : !data.available ? <p className="text-xs">{data.error || 'Falta activar la migración de características.'}</p> : <><CatalogDetailFields vertical={vertical} value={value} variantKeys={data.variantKeys} onChange={setDraft} disabled={saving || !hasPermission('products.update')} />{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<Button type="button" size="sm" disabled={saving || !draft || !hasPermission('products.update')} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar características'}</Button></>}</section>
}

export function ProductCatalogDetailsRead({ productId, expiry }: { productId: string; expiry?: { expected: boolean; variantId?: string } }) {
  const data = useProductCatalogDetails(productId)
  const rows = catalogDetailRows(data.details)
  return <>
    {(data.loading || data.error || (data.available && rows.length > 0)) && <section className="space-y-3 rounded-xl border p-4" aria-label="Características registradas"><h3 className="text-sm font-semibold">Características registradas</h3>{data.loading ? <p role="status" className="text-xs">Cargando características…</p> : data.error ? <p role="alert" className="text-xs">{data.error}</p> : <dl className="grid gap-3 sm:grid-cols-2">{rows.map(row => <div key={row.label} className="min-w-0"><dt className="text-xs text-muted-foreground">{row.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{row.value}</dd></div>)}</dl>}</section>}
    {expiry && <ProductExpirySummary productId={productId} variantId={expiry.variantId} expected={expiry.expected && data.details.expiry_policy !== 'not_applicable'} />}
  </>
}
