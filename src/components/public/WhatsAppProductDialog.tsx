'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  MessageCircle,
  ShoppingCart,
  HelpCircle,
  CreditCard,
  Truck,
  Copy,
  Check,
  Package,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  buildProductWhatsAppMessage,
  getWhatsAppLink,
  type WhatsAppInquiryIntent,
} from '@/lib/whatsapp'
import { formatPrice, cn } from '@/lib/utils'

export interface WhatsAppProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeName?: string | null
  phone: string
  productName: string
  price: number
  originalPrice?: number | null
  sku?: string | null
  variantName?: string | null
  attributes?: Record<string, string> | null
  inStock: boolean
  stockQuantity?: number | null
  installmentText?: string | null
  productUrl?: string | null
  imageUrl?: string | null
  initialIntent?: WhatsAppInquiryIntent
}

const INTENT_OPTIONS: {
  id: WhatsAppInquiryIntent
  label: string
  desc: string
  icon: typeof ShoppingCart
}[] = [
  {
    id: 'order',
    label: 'Pedir / Comprar',
    desc: 'Quiero solicitar este producto para entrega o retiro',
    icon: ShoppingCart,
  },
  {
    id: 'inquiry',
    label: 'Preguntar',
    desc: 'Quiero información general o disponibilidad',
    icon: HelpCircle,
  },
  {
    id: 'installments',
    label: 'Cuotas / Pagos',
    desc: 'Planes de cuotas con tarjetas o créditos',
    icon: CreditCard,
  },
  {
    id: 'shipping',
    label: 'Envíos / Costos',
    desc: 'Costo y tiempo estimado a mi localidad',
    icon: Truck,
  },
]

export function WhatsAppProductDialog({
  open,
  onOpenChange,
  storeName,
  phone,
  productName,
  price,
  originalPrice,
  sku,
  variantName,
  attributes,
  inStock,
  stockQuantity,
  installmentText,
  productUrl,
  imageUrl,
  initialIntent = 'order',
}: WhatsAppProductDialogProps) {
  const [intent, setIntent] = useState<WhatsAppInquiryIntent>(initialIntent)
  const [quantity, setQuantity] = useState(1)
  const [customerNote, setCustomerNote] = useState('')
  const [copied, setCopied] = useState(false)

  const message = useMemo(() => {
    return buildProductWhatsAppMessage({
      storeName,
      productName,
      price,
      originalPrice,
      sku,
      variantName,
      attributes,
      quantity,
      inStock,
      stockQuantity,
      installmentText,
      productUrl,
      imageUrl,
      intent,
      customerNote: customerNote.trim() || null,
    })
  }, [
    storeName,
    productName,
    price,
    originalPrice,
    sku,
    variantName,
    attributes,
    quantity,
    inStock,
    stockQuantity,
    installmentText,
    productUrl,
    imageUrl,
    intent,
    customerNote,
  ])

  const whatsappUrl = useMemo(() => {
    if (!phone) return null
    return getWhatsAppLink({
      phone,
      message,
    })
  }, [phone, message])

  const handleOpenWhatsApp = () => {
    if (!whatsappUrl) {
      toast.error('No hay un número de WhatsApp disponible')
      return
    }
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    onOpenChange(false)
  }

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      toast.success('Mensaje copiado al portapapeles')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar automáticamente')
    }
  }

  const totalPrice = price * quantity

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] sm:max-w-xl flex flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl border-border/80">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-r from-emerald-600/10 via-teal-500/10 to-background px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 shadow-xs">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                {storeName ? `Consultar con ${storeName}` : 'Consultar por WhatsApp'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enviá un mensaje estructurado con el producto, variante y tus dudas
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
          {/* 1. Tarjeta resumen del producto */}
          <div className="flex items-start gap-3.5 rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/40 flex items-center justify-center">
              {imageUrl && !imageUrl.startsWith('data:') && imageUrl !== '/placeholder-product.svg' ? (
                <Image
                  src={imageUrl}
                  alt={productName}
                  fill
                  sizes="64px"
                  unoptimized
                  className="object-contain p-1.5"
                />
              ) : (
                <Package className="h-7 w-7 text-muted-foreground/40" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-snug line-clamp-1 text-foreground">
                {productName}
              </p>
              {variantName && (
                <p className="mt-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 line-clamp-1">
                  ✨ {variantName}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-extrabold text-foreground">
                  {formatPrice(totalPrice)}
                </span>
                {quantity > 1 && (
                  <span className="text-[11px] text-muted-foreground">
                    ({quantity} × {formatPrice(price)})
                  </span>
                )}
                {sku && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    SKU: {sku}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Selector de motivo o intención */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              ¿Qué te gustaría hacer?
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {INTENT_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isSelected = intent === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIntent(opt.id)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all',
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500'
                        : 'border-border/70 bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 mb-1', isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
                    <span className="text-[11px] font-bold leading-tight line-clamp-1">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. Selector de cantidad y nota */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Cantidad */}
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cantidad
              </label>
              <div className="flex h-10 items-center justify-between rounded-xl border border-border/80 bg-background px-2">
                <button
                  type="button"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted disabled:opacity-30"
                  aria-label="Restar una unidad"
                >
                  −
                </button>
                <span className="text-xs font-extrabold tabular-nums">{quantity}</span>
                <button
                  type="button"
                  disabled={typeof stockQuantity === 'number' && stockQuantity > 0 && quantity >= stockQuantity}
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted disabled:opacity-30"
                  aria-label="Sumar una unidad"
                >
                  +
                </button>
              </div>
            </div>

            {/* Consulta o nota opcional */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nota o pregunta adicional <span className="font-normal normal-case text-[11px]">(opcional)</span>
              </label>
              <input
                type="text"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Ej. ¿Tienen entrega hoy? ¿Puedo pagar al recibir?"
                className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-xs placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 4. Previsualización estilo chat de WhatsApp */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <span>Mensaje que se enviará</span>
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copiado' : 'Copiar texto'}</span>
              </button>
            </div>

            {/* Burbuja WhatsApp */}
            <div className="relative rounded-2xl border border-emerald-500/20 bg-[#e7f8ee] dark:bg-[#0b2817]/70 p-3.5 shadow-2xs">
              <div className="whitespace-pre-line text-xs font-sans leading-relaxed text-slate-800 dark:text-slate-200">
                {message}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span>Ahora</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer con llamada a la acción principal */}
        <div className="shrink-0 flex flex-col sm:flex-row items-stretch gap-2.5 border-t border-border/70 bg-background p-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-border/80 text-xs sm:text-sm font-semibold h-11"
          >
            Cerrar
          </Button>

          <Button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex-1 gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold shadow-md shadow-emerald-600/20 h-11 text-xs sm:text-sm"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Abrir en WhatsApp</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
