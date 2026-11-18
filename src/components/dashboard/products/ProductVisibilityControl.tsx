'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { z } from 'zod'
import { Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useBranch } from '@/contexts/branch-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { branchHeaders } from '@/lib/branches/client'

export type ProductVisibilityPatch = { visibility: 'public' | 'wholesale' | 'hidden'; hide_price: boolean }
export type ProductVisibilitySaved = (productId: string, patch: ProductVisibilityPatch) => void
type VisibilityProduct = { id: string; organization_id?: string | null; visibility?: string | null; hide_price?: boolean | null; is_active?: boolean | null }
type Mode = ProductVisibilityPatch['visibility'] | 'public_no_price'
const descriptions: Record<Mode, string> = {
  public: 'Visible para todos, con precio público.',
  public_no_price: 'Visible para todos. El precio queda reservado para clientes mayoristas autorizados.',
  wholesale: 'Visible únicamente para clientes mayoristas autorizados.',
  hidden: 'No se muestra en la tienda pública ni en el marketplace. Sigue disponible en el sistema interno.',
}
const savedSchema = z.object({ id: z.string(), visibility: z.enum(['public', 'wholesale', 'hidden']), hide_price: z.boolean().nullable().optional() })
function modeOf(product: Pick<VisibilityProduct, 'visibility' | 'hide_price'>): Mode {
  if (product.visibility === 'hidden' || product.visibility === 'wholesale') return product.visibility
  return product.hide_price ? 'public_no_price' : 'public'
}

export function ProductVisibilityControl({ product, onSaved }: { product: VisibilityProduct; onSaved: ProductVisibilitySaved }) {
  const { scope, organizationId } = useTenantScope()
  const { selectedBranchId } = useBranch()
  if (!organizationId || (product.organization_id && product.organization_id !== organizationId)) return null
  return <VisibilityEditor key={`${scope}:${selectedBranchId}:${product.id}:${modeOf(product)}`} product={product} onSaved={onSaved} />
}

function VisibilityEditor({ product, onSaved }: { product: VisibilityProduct; onSaved: ProductVisibilitySaved }) {
  const id = useId()
  const { scope, currentScope } = useTenantScope()
  const { selectedBranchId } = useBranch()
  const { hasPermission } = useAuth()
  const { effectiveModules } = useSubscriptionStatus()
  const canEdit = hasPermission('products.update') && (effectiveModules.includes('inventory') || effectiveModules.includes('services'))
  const [saved, setSaved] = useState<Mode>(() => modeOf(product))
  const [draft, setDraft] = useState<Mode>(() => modeOf(product))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const alive = useRef(true)
  const inFlight = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const isCurrent = () => alive.current && currentScope.current === scope

  const save = async () => {
    if (!canEdit || inFlight.current || draft === saved || !isCurrent()) return
    inFlight.current = true
    setSaving(true); setError(null); setMessage(null)
    const patch: ProductVisibilityPatch = { visibility: draft === 'public_no_price' ? 'public' : draft, hide_price: draft === 'public_no_price' }
    try {
      const response = await fetch('/api/products', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...branchHeaders(selectedBranchId) },
        body: JSON.stringify({ id: product.id, ...patch }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudo guardar la visibilidad.')
      const result = savedSchema.safeParse(body.data?.product ?? body.data)
      if (!result.success || result.data.id !== product.id) throw new Error('No se pudo confirmar la visibilidad guardada. Actualizá la ficha para verificarla.')
      if (!isCurrent()) return
      const actual: ProductVisibilityPatch = { visibility: result.data.visibility, hide_price: result.data.hide_price === true }
      const actualMode = modeOf(actual)
      setSaved(actualMode); setDraft(actualMode)
      if (body.hide_price_skipped || actual.hide_price !== patch.hide_price || actual.visibility !== patch.visibility) {
        const warning = body.hide_price_skipped ? 'La publicación se guardó, pero el precio sigue visible. No se pudo aplicar la ocultación del precio.' : 'El servidor confirmó una visibilidad diferente. Revisá la opción guardada antes de continuar.'
        setError(warning); toast.warning(warning)
      } else {
        setMessage('Visibilidad guardada.'); toast.success('Visibilidad guardada.')
      }
      onSaved(product.id, actual)
    } catch (error) {
      if (isCurrent()) setError(error instanceof Error ? error.message : 'No se pudo guardar la visibilidad.')
    } finally {
      inFlight.current = false
      if (isCurrent()) setSaving(false)
    }
  }

  return <section className="space-y-3 rounded-xl border bg-background p-4" aria-label="Publicación en tienda">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4 text-primary" aria-hidden="true" />Publicación en tienda</h3>
    <label htmlFor={id} className="block text-xs font-medium">Visibilidad en tienda</label>
    <select id={id} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" value={draft} disabled={saving || !canEdit} aria-describedby={`${id}-help`} onChange={event => { setDraft(event.target.value as Mode); setError(null); setMessage(null) }}>
      <option value="public">Público con precio</option><option value="public_no_price">Público sin precio</option><option value="wholesale">Solo mayoristas</option><option value="hidden">Oculto en tienda</option>
    </select>
    <p id={`${id}-help`} className="text-xs leading-relaxed text-muted-foreground">{descriptions[draft]}</p>
    {product.is_active === false && <p className="text-xs text-muted-foreground">Este producto está inactivo. Cambiar la visibilidad no lo activa.</p>}
    {!canEdit && <p className="text-xs text-muted-foreground">Necesitás permiso para editar productos para cambiar esta opción.</p>}
    {error && <p role="alert" className="text-xs leading-relaxed text-destructive">{error}</p>}
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    {canEdit && <div className="flex justify-end"><Button type="button" size="sm" disabled={saving || draft === saved} onClick={() => void save()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{saving ? 'Guardando…' : 'Guardar visibilidad'}</Button></div>}
  </section>
}
