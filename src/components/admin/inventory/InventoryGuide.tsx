'use client'

import { useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  AlertTriangle,
  ArrowRightLeft,
  BookOpen,
  Building2,
  CheckCircle,
  ChevronDown,
  HelpCircle,
  Layers,
  PackageMinus,
  PackagePlus,
  SlidersHorizontal,
  TrendingUp,
  XCircle,
} from 'lucide-react'

const GUIDE_STORAGE_KEY = 'mipos:inventory:guide-open'

/**
 * La guia anterior eran tres frases de una linea cada una, siempre plegada y sin
 * memoria: quien la necesitaba la abria en cada visita y no encontraba nada
 * accionable adentro. Esta explica el modelo de stock con ejemplos concretos,
 * porque la confusion recurrente —«vendi y el stock no baja»— no se resuelve
 * diciendo «el stock es por sucursal», sino mostrando el numero moviendose.
 */
export function InventoryGuide() {
  const [open, setOpen] = useState(() => {
    try {
      return window.localStorage.getItem(GUIDE_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const toggle = () => {
    setOpen((current) => {
      const next = !current
      try {
        window.localStorage.setItem(GUIDE_STORAGE_KEY, String(next))
      } catch {
        // Ventana privada: la guia simplemente vuelve a arrancar plegada.
      }
      return next
    })
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-foreground">
          <BookOpen className="h-4 w-4 shrink-0 text-primary" />
          Cómo funciona el inventario
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
          {open ? 'Ocultar guía' : 'Ver guía'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4">
          <Accordion type="multiple" defaultValue={['modelo']} className="w-full">
            <ModeloDeStock />
            <Secciones />
            <Movimientos />
            <EstadosDeStock />
            <Indicadores />
            <Situaciones />
          </Accordion>
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ piezas */

function Item({
  value,
  icon: Icon,
  title,
  children,
}: {
  value: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <AccordionItem value={value} className="border-border">
      <AccordionTrigger className="py-3 text-left text-xs font-bold text-foreground hover:no-underline">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          {title}
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-4 text-[13px] leading-relaxed text-muted-foreground">
        {children}
      </AccordionContent>
    </AccordionItem>
  )
}

/** Un ejemplo trabajado. Los numeros importan mas que la explicacion. */
function Ejemplo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">{titulo}</p>
      <div className="space-y-1.5 text-[13px] text-foreground">{children}</div>
    </div>
  )
}

function Fila({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: 'sube' | 'baja' }) {
  const color = tono === 'sube'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tono === 'baja'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-foreground'
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 text-muted-foreground">{etiqueta}</span>
      <span className={`shrink-0 font-semibold tabular-nums ${color}`}>{valor}</span>
    </div>
  )
}

/* ---------------------------------------------------------------- secciones */

function ModeloDeStock() {
  return (
    <Item value="modelo" icon={Building2} title="1. El catálogo es uno; las existencias son de cada sucursal">
      <p>
        Un producto se carga <strong className="text-foreground">una sola vez</strong> para toda la
        empresa: nombre, SKU, precio, costo, categoría y proveedor. Eso es el catálogo, y es igual en
        todas las sucursales.
      </p>
      <p>
        Las <strong className="text-foreground">unidades</strong>, en cambio, viven en cada sucursal
        por separado. El selector de sucursal de la cabecera decide qué existencias estás viendo y
        sobre cuáles operás.
      </p>

      <Ejemplo titulo="Ejemplo">
        <p className="mb-2">
          Cargador USB-C · SKU <span className="font-mono text-xs">CAR-001</span> · precio 45.000 Gs ·
          costo 28.000 Gs
        </p>
        <Fila etiqueta="Sucursal Centro" valor="12 unidades" />
        <Fila etiqueta="Sucursal Shopping" valor="3 unidades" />
        <Fila etiqueta="Depósito" valor="40 unidades" />
        <p className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
          Si subís el precio a 50.000 Gs, cambia para las tres. Si ajustás el stock, cambia solo
          donde estés parado.
        </p>
      </Ejemplo>

      <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Antes de mover stock, mirá la insignia de sucursal arriba a la derecha del título. Es el
          origen de casi toda la confusión: ajustar en Centro y después preguntarse por qué Shopping
          no cambió.
        </span>
      </p>
    </Item>
  )
}

function Secciones() {
  const operacion = [
    { nombre: 'Catálogo', que: 'Alta y edición de productos. El stock de la columna es el de la sucursal activa.' },
    { nombre: 'Stock por sucursal', que: 'Donde se mueve el stock: entradas, salidas, ajustes y transferencias.' },
    { nombre: 'Movimientos', que: 'El historial. Cada venta, ajuste y transferencia, con el stock anterior y el nuevo.' },
    { nombre: 'Alertas', que: 'Lo agotado y lo que está en o debajo del mínimo, en la sucursal activa.' },
  ]
  const gestion = [
    { nombre: 'Proveedores', que: 'A quién le comprás. El producto exige uno al crearse.' },
    { nombre: 'Categorías', que: 'Cómo se organiza el catálogo, con cuántos productos tiene cada una.' },
    { nombre: 'Variantes', que: 'Talle, color, capacidad. Cada variante lleva su propio stock y precio.' },
    { nombre: 'Promociones', que: 'Códigos de descuento, con su vigencia y cuántas veces se usaron.' },
    { nombre: 'Reportes', que: 'Valor del inventario, rotación, márgenes y lo más vendido del período.' },
    { nombre: 'Búsqueda avanzada', que: 'Filtros combinados. Al buscar, te lleva a Catálogo con el resultado.' },
  ]

  return (
    <Item value="secciones" icon={Layers} title="2. Qué hace cada sección">
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Operación · el día a día
          </p>
          <ul className="space-y-1.5">
            {operacion.map((s) => (
              <li key={s.nombre} className="flex flex-col gap-0.5 border-l-2 border-primary/40 pl-2.5">
                <span className="text-[13px] font-semibold text-foreground">{s.nombre}</span>
                <span className="text-[12px]">{s.que}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Gestión · se configura de vez en cuando
          </p>
          <ul className="space-y-1.5">
            {gestion.map((s) => (
              <li key={s.nombre} className="flex flex-col gap-0.5 border-l-2 border-border pl-2.5">
                <span className="text-[13px] font-semibold text-foreground">{s.nombre}</span>
                <span className="text-[12px]">{s.que}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-[12px]">
        La pestaña queda guardada en la dirección del navegador: podés recargar o compartir el enlace
        y volvés al mismo lugar.
      </p>
    </Item>
  )
}

function Movimientos() {
  return (
    <Item value="movimientos" icon={ArrowRightLeft} title="3. Los cuatro movimientos, con números">
      <p>
        Todo se hace desde <strong className="text-foreground">Stock por sucursal → Nuevo
        Movimiento</strong>. Los ejemplos siguen al mismo cargador, que arranca con 12 en Centro.
      </p>

      <div className="space-y-2.5">
        <Ejemplo titulo="Entrada · llegó mercadería">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <PackagePlus className="h-3.5 w-3.5 text-emerald-500" />
            Comprás 20 cargadores al proveedor.
          </p>
          <Fila etiqueta="Ingresás cantidad" valor="20" />
          <Fila etiqueta="Centro pasa de 12 a" valor="32" tono="sube" />
        </Ejemplo>

        <Ejemplo titulo="Salida · se fue sin venderse">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <PackageMinus className="h-3.5 w-3.5 text-rose-500" />
            Dos llegaron rotos y los descartás.
          </p>
          <Fila etiqueta="Ingresás cantidad" valor="2" />
          <Fila etiqueta="Centro pasa de 32 a" valor="30" tono="baja" />
        </Ejemplo>

        <Ejemplo titulo="Ajuste · contaste y no coincide">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-500" />
            Hacés conteo físico y encontrás 28, no 30.
          </p>
          <Fila etiqueta="Ingresás el stock final" valor="28" />
          <Fila etiqueta="Centro queda en" valor="28" tono="baja" />
          <p className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
            El ajuste <strong className="text-foreground">define</strong> el número: no suma ni
            resta. Ese es el campo donde más gente se equivoca — si querés sacar 2, usá Salida.
          </p>
        </Ejemplo>

        <Ejemplo titulo="Transferencia · de una sucursal a otra">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <ArrowRightLeft className="h-3.5 w-3.5 text-violet-500" />
            Mandás 10 del Depósito a Centro.
          </p>
          <Fila etiqueta="Depósito pasa de 40 a" valor="30" tono="baja" />
          <Fila etiqueta="Centro pasa de 28 a" valor="38" tono="sube" />
          <p className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
            Quedan dos registros, uno en cada sucursal, con la misma referencia.
          </p>
        </Ejemplo>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-[12px]">
        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span>
          <strong className="text-foreground">Las ventas no se cargan a mano.</strong> Cada venta del
          punto de venta descuenta el stock y deja su propio registro en Movimientos, con el stock
          anterior y el nuevo. Si un movimiento no lo hiciste vos, fijate la referencia: dice el
          número de venta.
        </span>
      </p>
    </Item>
  )
}

function EstadosDeStock() {
  return (
    <Item value="estados" icon={TrendingUp} title="4. Qué significa cada etiqueta de stock">
      <div className="space-y-2">
        <div className="flex items-start gap-2.5">
          <Badge className="mt-0.5 shrink-0 border-0 bg-red-100 text-[10px] text-red-800 dark:bg-red-900/30 dark:text-red-300">Agotado</Badge>
          <span className="text-[12px]">Cero unidades en la sucursal activa. No se puede vender.</span>
        </div>
        <div className="flex items-start gap-2.5">
          <Badge className="mt-0.5 shrink-0 border-0 bg-yellow-100 text-[10px] text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">Bajo</Badge>
          <span className="text-[12px]">
            Está en el mínimo o por debajo. El mínimo puede ser distinto en cada sucursal: el
            depósito y un kiosco no necesitan el mismo.
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <Badge className="mt-0.5 shrink-0 border-0 bg-green-100 text-[10px] text-green-800 dark:bg-green-900/30 dark:text-green-300">Normal</Badge>
          <span className="text-[12px]">Arriba del mínimo y sin pasarse del máximo.</span>
        </div>
        <div className="flex items-start gap-2.5">
          <Badge className="mt-0.5 shrink-0 border-0 bg-blue-100 text-[10px] text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Alto</Badge>
          <span className="text-[12px]">
            Llegó al máximo. <strong className="text-foreground">Solo aparece si cargaste un
            máximo</strong>: dejarlo vacío significa «sin techo», no «techo cero».
          </span>
        </div>
      </div>

      <Ejemplo titulo="Los dos casos que se confunden">
        <p className="text-[12px] text-muted-foreground">Mínimo 5, máximo sin cargar:</p>
        <Fila etiqueta="con 3 unidades" valor="Bajo" />
        <Fila etiqueta="con 50 unidades" valor="Normal" />
        <p className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">
          Mínimo 5, máximo 40:
        </p>
        <Fila etiqueta="con 50 unidades" valor="Alto" />
      </Ejemplo>
    </Item>
  )
}

function Indicadores() {
  return (
    <Item value="indicadores" icon={CheckCircle} title="5. Cómo leer los indicadores de arriba">
      <p>
        Las cuatro tarjetas del encabezado hablan de{' '}
        <strong className="text-foreground">todo el catálogo</strong>, no de la página que estás
        viendo. Cada una dice abajo de qué universo habla: «En toda la empresa» o «En Sucursal
        Centro».
      </p>
      <ul className="space-y-1.5 text-[12px]">
        <li className="flex gap-2">
          <span className="font-semibold text-foreground">Productos en catálogo</span>
          <span>— cuántos hay dados de alta. Es igual para todas las sucursales.</span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-foreground">Sin stock</span>
          <span>— cuántos están en cero donde estás parado.</span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-foreground">Stock bajo</span>
          <span>— cuántos llegaron al mínimo o lo pasaron.</span>
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-foreground">Valor a costo</span>
          <span>— la suma de unidades × precio de compra. Lo que tenés inmovilizado.</span>
        </li>
      </ul>

      <Ejemplo titulo="Valor a costo, cómo sale">
        <Fila etiqueta="30 cargadores × 28.000 Gs" valor="840.000 Gs" />
        <Fila etiqueta="4 fundas × 15.000 Gs" valor="60.000 Gs" />
        <div className="mt-1 border-t border-border pt-1.5">
          <Fila etiqueta="Valor a costo" valor="900.000 Gs" />
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Es lo que <em>costó</em>, no lo que vale vendido.
        </p>
      </Ejemplo>

      <p className="text-[12px]">
        Si una tarjeta dice <strong className="text-foreground">«Sin datos»</strong>, no se pudieron
        calcular las cifras. No es cero: es que no se sabe.
      </p>
    </Item>
  )
}

function Situaciones() {
  const casos = [
    {
      p: '«Vendí y el stock no bajó»',
      r: 'Fijate en qué sucursal estás parado. La venta descuenta donde se hizo, y vos podés estar mirando otra. Cambiá el selector de la cabecera.',
    },
    {
      p: '«Puse un ajuste y el número quedó mal»',
      r: 'El ajuste define el stock final, no suma ni resta. Si tenías 30 e ingresaste 2, quedaste en 2. Para sacar 2 unidades es Salida.',
    },
    {
      p: '«Me dice que el stock cambió mientras cargaba»',
      r: 'Alguien vendió ese producto mientras tenías el formulario abierto. El sistema no pisa esa venta: cerrá, mirá el número actual y volvé a hacer el movimiento.',
    },
    {
      p: '«No me deja crear un producto»',
      r: 'El formulario exige categoría y proveedor. Creá primero uno de cada cosa en sus pestañas de Gestión.',
    },
    {
      p: '«Exporté a Excel y se ve todo en una columna»',
      r: 'No debería pasar: el archivo sale con punto y coma y con las tildes bien. Si te pasa, abrilo con Datos → Desde texto y elegí punto y coma como separador.',
    },
    {
      p: '«El listado dice que es parcial»',
      r: 'Con un filtro de stock activo, el catálogo se recorre hasta un tope. Quitá ese filtro para ver el total exacto.',
    },
    {
      p: '«Veo movimientos viejos en una sucursal donde no los hice»',
      r: 'Los ajustes anteriores a la última actualización no guardaban la sucursal, así que quedaron en la principal. Los nuevos van a la correcta.',
    },
  ]

  return (
    <Item value="situaciones" icon={HelpCircle} title="6. Situaciones comunes">
      <div className="space-y-2.5">
        {casos.map((caso) => (
          <div key={caso.p} className="border-l-2 border-border pl-2.5">
            <p className="text-[13px] font-semibold text-foreground">{caso.p}</p>
            <p className="mt-0.5 text-[12px]">{caso.r}</p>
          </div>
        ))}
      </div>
    </Item>
  )
}

export default InventoryGuide
