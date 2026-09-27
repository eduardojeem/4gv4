'use client'

import { useRef, useState, type MouseEvent } from 'react'
import { Minus, Plus, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'

export interface CheckoutProductItem {
  id: string
  name: string
  price: number
  quantity: number
  stock?: number
  sku?: string
  category?: string
  categoryName?: string
  brand?: string
  image?: string
  wholesalePrice?: number
  isService?: boolean
}

export function CheckoutProductRow({ item, unitPrice, formatCurrency, onUpdateQuantity, disabled = false }: {
  item: CheckoutProductItem
  unitPrice: number
  formatCurrency: (value: number) => string
  onUpdateQuantity?: (id: string, quantity: number) => void
  disabled?: boolean
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [failedImage, setFailedImage] = useState<string>()
  const opener = useRef<HTMLButtonElement | null>(null)
  const openDetail = (event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget
    setDetailOpen(true)
  }
  const canEdit = !!onUpdateQuantity && !item.isService
  return <article className="min-w-0 space-y-1 bg-background px-2 py-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <button type="button" aria-haspopup="dialog" onClick={openDetail} className="line-clamp-2 break-words rounded-sm text-left text-xs font-medium leading-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={item.name}>{item.name}</button>
        <p className="text-xs text-muted-foreground">{item.quantity} × {formatCurrency(unitPrice)}</p>
      </div>
      <p className="shrink-0 text-right text-xs font-semibold tabular-nums" aria-label={`Importe de línea: ${formatCurrency(unitPrice * item.quantity)}`}>{formatCurrency(unitPrice * item.quantity)}</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      {canEdit ? <div className="flex items-center gap-1" role="group" aria-label={`Cantidad de ${item.name}`}>
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" aria-label={`Reducir cantidad de ${item.name}`} disabled={disabled || item.quantity <= 1} onClick={() => onUpdateQuantity?.(item.id, item.quantity - 1)}><Minus className="h-3.5 w-3.5" /></Button>
        <span className="min-w-5 text-center text-xs font-semibold tabular-nums" aria-live="polite">{item.quantity}</span>
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" aria-label={`Aumentar cantidad de ${item.name}`} disabled={disabled || (typeof item.stock === 'number' && item.quantity >= item.stock)} onClick={() => onUpdateQuantity?.(item.id, item.quantity + 1)}><Plus className="h-3.5 w-3.5" /></Button>
      </div> : <span className="text-xs text-muted-foreground">Cantidad: {item.quantity}</span>}
      <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8" aria-haspopup="dialog" onClick={openDetail}>
        Ver detalle<Info aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto p-4 sm:max-w-sm" onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus() }}>
        <DialogHeader className="pr-7 text-left">
          {item.image && failedImage !== item.image ? (
            // Use the catalog URL as-is: small tenant images need no image optimizer configuration.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt={item.name} width={64} height={64} className="h-16 w-16 rounded-md border bg-muted object-contain" onError={() => setFailedImage(item.image)} />
          ) : <span className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted text-center text-xs text-muted-foreground">Sin imagen</span>}
          <DialogTitle className="break-words text-base leading-snug">{item.name}</DialogTitle>
          <DialogDescription>Detalle del {item.isService ? 'servicio' : 'producto'} en esta venta.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
      <dt className="text-muted-foreground">Código / SKU</dt><dd className="break-words">{item.sku || 'Sin código'}</dd>
      <dt className="text-muted-foreground">Categoría</dt><dd className="break-words">{item.categoryName || (item.isService ? 'Servicios' : 'Sin categoría disponible')}</dd>
      <dt className="text-muted-foreground">Marca</dt><dd className="break-words">{item.brand || 'Sin marca'}</dd>
      <dt className="text-muted-foreground">Stock registrado</dt><dd>{item.isService ? 'No aplica' : item.stock ?? 'No disponible'}</dd>
          <dt className="text-muted-foreground">Precio unitario</dt><dd className="tabular-nums">{formatCurrency(unitPrice)}</dd>
          <dt className="text-muted-foreground">Cantidad en venta</dt><dd>{item.quantity}</dd>
        </dl>
        <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Importe de línea antes de descuentos adicionales</p><p className="text-lg font-semibold tabular-nums">{formatCurrency(unitPrice * item.quantity)}</p></div>
        <DialogClose asChild><Button type="button" variant="outline" className="w-full">Volver al cobro</Button></DialogClose>
      </DialogContent>
    </Dialog>
  </article>
}
