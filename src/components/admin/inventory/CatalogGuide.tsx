'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, Building2, Check, ChevronDown, Lightbulb, MousePointerClick, PackagePlus, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { STOCK_LEVEL_STYLE } from '@/components/admin/inventory/CatalogProductGrid'

const GUIDE_KEY = 'mipos:inventory:catalog-guide-open'

/**
 * Cómo se lee y se usa el catálogo, en la misma pantalla. Arranca abierta la
 * primera vez y después recuerda si la plegaste.
 */
export function CatalogGuide({ branchName, onOpenFullGuide }: { branchName: string; onOpenFullGuide: () => void }) {
  const [open, setOpen] = useState(() => {
    try {
      return window.localStorage.getItem(GUIDE_KEY) !== 'false'
    } catch {
      return true
    }
  })

  const toggle = () => {
    setOpen((current) => {
      const next = !current
      try {
        window.localStorage.setItem(GUIDE_KEY, String(next))
      } catch {
        // Sin almacenamiento la guía vuelve a abrirse la próxima vez.
      }
      return next
    })
  }

  const tips = [
    {
      icon: Building2,
      title: 'Un catálogo, stock por sucursal',
      text: `Precio, costo y datos son iguales en todas las sucursales. La columna de stock es la de ${branchName}.`,
    },
    {
      icon: MousePointerClick,
      title: 'Cada producto, tres acciones',
      text: 'Stock registra una entrada, salida o ajuste. Editar cambia precio y datos. Variantes maneja talle o color.',
    },
    {
      icon: Lightbulb,
      title: 'Cargá el mínimo',
      text: 'Con un stock mínimo el sistema te avisa cuándo reponer. Sin mínimo, el producto nunca aparece como «Bajo».',
    },
  ]

  return (
    <div className="rounded-xl border bg-muted/30">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2 text-sm text-foreground">
          <BookOpen className="h-4 w-4 text-primary" /> Cómo funciona el catálogo
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {open ? 'Ocultar' : 'Mostrar'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t px-3.5 pb-3.5 pt-3">
          <div className="grid gap-3 md:grid-cols-3">
            {tips.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs text-foreground">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>Estados de stock:</span>
              {(['out', 'low', 'normal', 'high'] as const).map((level) => (
                <span key={level} className={cn('rounded-full px-2 py-0.5', STOCK_LEVEL_STYLE[level].badge)}>
                  {STOCK_LEVEL_STYLE[level].label}
                </span>
              ))}
              <span>· «Alto» solo aparece si cargaste un máximo.</span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onOpenFullGuide}>
              Guía completa
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Primeros pasos cuando todavía no hay productos: lo que exige el formulario, en orden. */
export function CatalogFirstSteps({
  categories,
  suppliers,
  onAddSupplier,
  onAddProduct,
}: {
  categories: number
  suppliers: number
  onAddSupplier: () => void
  onAddProduct: () => void
}) {
  const steps = [
    {
      title: 'Creá tus categorías',
      text: 'Agrupan el catálogo: «Fundas», «Cargadores», «Bebidas».',
      done: categories > 0,
      action: (
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/dashboard/categories"><Tags className="h-3.5 w-3.5" /> Categorías</Link>
        </Button>
      ),
    },
    {
      title: 'Cargá un proveedor',
      text: 'A quién le comprás. Cada producto se asocia a uno.',
      done: suppliers > 0,
      action: <Button variant="outline" size="sm" onClick={onAddSupplier}>Proveedores</Button>,
    },
    {
      title: 'Agregá tu primer producto',
      text: 'Nombre, precio, costo y stock inicial. Después registrás las entradas desde «Stock».',
      done: false,
      action: (
        <Button size="sm" className="gap-1.5" onClick={onAddProduct}>
          <PackagePlus className="h-3.5 w-3.5" /> Nuevo producto
        </Button>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">
      <div>
        <p className="text-base text-foreground">Armá tu catálogo en tres pasos</p>
        <p className="text-xs text-muted-foreground">Con los productos cargados vas a ver stock, alertas y el valor de tu inventario.</p>
      </div>
      <ol className="space-y-2 text-left">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-center gap-3 rounded-xl border bg-background p-3">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs',
                step.done ? 'bg-emerald-500 text-white' : 'border text-muted-foreground',
              )}
              aria-label={step.done ? 'Listo' : `Paso ${index + 1}`}
            >
              {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm', step.done ? 'text-muted-foreground line-through' : 'text-foreground')}>{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.text}</p>
            </div>
            {!step.done && step.action}
          </li>
        ))}
      </ol>
    </div>
  )
}
