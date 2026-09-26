'use client'

import { Eye, MessageCircle, ShoppingCart, CheckCircle2, Store } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PublicCommerceMode } from '@/types/website-settings'

const COMMERCE_MODES = [
  {
    value: 'cart',
    label: 'Carrito y pedidos en línea',
    tag: 'Pedidos en línea',
    tagColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
    shortDesc: 'Venta completa en línea con carrito de compras, pasarela de checkout y cálculo de envíos.',
    icon: ShoppingCart,
    details: {
      howItWorks: 'Tus clientes eligen productos, los agregan a su bolsa, seleccionan la forma de entrega (Delivery a domicilio o Retiro en local) y confirman el pago (Efectivo, Tarjeta, Transferencia o QR).',
      whatCustomerSees: 'Botón "Agregar al carrito" en cada producto, icono de bolsa de compras en el encabezado y pantalla de confirmación de pedido.',
      bestFor: 'Tiendas de accesorios, repuestos y tecnología que quieren automatizar ventas y recibir pedidos organizados.',
    },
  },
  {
    value: 'whatsapp',
    label: 'Consultas por WhatsApp',
    tag: 'Inicial para nuevas tiendas',
    tagColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    shortDesc: 'Cada producto abre un chat de WhatsApp con el artículo y precio prearmado para atención directa.',
    icon: MessageCircle,
    details: {
      howItWorks: 'El carrito se oculta. Al hacer clic en un producto, el cliente es redirigido a WhatsApp con un mensaje automático que dice: "Hola, me interesa [Nombre del Producto] por [Precio]".',
      whatCustomerSees: 'Botón verde destacado "Consultar por WhatsApp" en cada artículo. No se solicita dirección ni métodos de pago en la web.',
      bestFor: 'Negocios que prefieren asesorar al cliente, verificar compatibilidad técnica o negociar precios y formas de entrega por chat.',
    },
  },
  {
    value: 'catalog',
    label: 'Solo Catálogo Digital',
    tag: 'Vitrina Informativa',
    tagColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    shortDesc: 'Vitrina online para exhibir stock, fotos y precios sin botones de compra ni pedidos.',
    icon: Eye,
    details: {
      howItWorks: 'Tu página funciona como un catálogo interactivo. Los clientes pueden ver productos, fotos en alta resolución, descripciones y precios sin procesar compras en línea.',
      whatCustomerSees: 'Ficha completa de cada producto con su precio y características, pero sin botón de agregar al carrito.',
      bestFor: 'Empresas que atienden solo de forma presencial en mostrador o mayoristas que exhiben mercadería para visitas físicas.',
    },
  },
] satisfies Array<{
  value: PublicCommerceMode
  label: string
  tag: string
  tagColor: string
  shortDesc: string
  icon: typeof ShoppingCart
  details: {
    howItWorks: string
    whatCustomerSees: string
    bestFor: string
  }
}>

export function CommerceModeSelector({
  value,
  onChange,
}: {
  value: PublicCommerceMode
  onChange: (value: PublicCommerceMode) => void
}) {
  const selectedModeObj = COMMERCE_MODES.find(m => m.value === value) || COMMERCE_MODES[0]

  return (
    <section aria-labelledby="commerce-mode-title" className="rounded-xl border bg-card p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 id="commerce-mode-title" className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <span>Modalidad Comercial de tu Tienda</span>
          </h2>
          <Badge variant="outline" className="text-[10px] font-bold">
            Paso 1
          </Badge>
        </div>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Elige cómo quieres que tus clientes interactúen con tus productos en la tienda pública. Puedes cambiar de modalidad en cualquier momento con un solo clic.
        </p>
      </div>

      {/* Selector de 3 Tarjetas */}
      <div role="radiogroup" aria-label="Modo de venta pública" className="grid gap-3.5 sm:grid-cols-3">
        {COMMERCE_MODES.map(({ value: mode, label, tag, tagColor, shortDesc, icon: Icon }) => {
          const selected = value === mode

          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(mode)}
              className={cn(
                'flex flex-col justify-between items-start gap-2 rounded-xl border p-3 text-left transition-all relative overflow-hidden',
                selected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                  : 'border-border/80 bg-background hover:border-primary/40 hover:bg-muted/30'
              )}
            >
              <div className="w-full flex items-center justify-between gap-2">
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  selected ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground'
                )}>
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </div>
                {selected ? (
                  <Badge className="bg-primary text-primary-foreground text-[10px] font-extrabold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Activo</span>
                  </Badge>
                ) : (
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', tagColor)}>
                    {tag}
                  </span>
                )}
              </div>

              <div className="space-y-1 mt-1">
                <span className="block text-sm font-bold text-foreground leading-tight">
                  {label}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground font-normal">
                  {shortDesc}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Explicación Detallada del Modo Activo */}
      <details className="rounded-lg border bg-muted/20 p-3">
        <summary className="cursor-pointer text-sm font-medium">
            ¿Cómo funciona el modo &ldquo;{selectedModeObj.label}&rdquo;?
        </summary>

        <div className="grid gap-3 sm:grid-cols-3 pt-1 text-xs">
          <div className="p-3 rounded-xl bg-background border space-y-1">
            <span className="font-bold text-foreground block">
              1. Flujo de Venta:
            </span>
            <p className="text-muted-foreground leading-relaxed">
              {selectedModeObj.details.howItWorks}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-background border space-y-1">
            <span className="font-bold text-foreground block">
              2. Lo que ve el Cliente:
            </span>
            <p className="text-muted-foreground leading-relaxed">
              {selectedModeObj.details.whatCustomerSees}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-background border space-y-1">
            <span className="font-bold text-foreground block">
              3. ¿Cuándo elegirlo?:
            </span>
            <p className="text-muted-foreground leading-relaxed">
              {selectedModeObj.details.bestFor}
            </p>
          </div>
        </div>
      </details>
    </section>
  )
}
