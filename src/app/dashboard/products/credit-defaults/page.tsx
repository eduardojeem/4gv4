'use client'

import Link from 'next/link'
import { ArrowLeft, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RouteGuard } from '@/components/auth/permission-guard'
import { ProductCreditDefaultsEditor } from '@/components/dashboard/products/ProductCreditDefaultsEditor'

export default function ProductCreditDefaultsPage() {
  return (
    <RouteGuard route="/dashboard/products">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 px-2 text-xs text-muted-foreground">
              <Link href="/dashboard/products">
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a Productos
              </Link>
            </Button>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <Wallet className="h-3.5 w-3.5" />
              Productos a crédito
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              Datos predeterminados de cuotas
            </h1>
          </div>
        </header>

        <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 rounded-xl p-5 md:p-6 mb-2">
          <h2 className="text-sm font-bold text-sky-900 dark:text-sky-300 mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-200 dark:bg-sky-900 text-sky-700 dark:text-sky-300">
              <span className="sr-only">Información</span>
              i
            </span>
            ¿Para qué sirve esta sección?
          </h2>
          <div className="text-sm text-sky-800 dark:text-sky-200 space-y-3 leading-relaxed">
            <p>
              Aquí podés configurar las <strong>condiciones globales por defecto</strong> que tendrán los productos cuando decidas venderlos a crédito o en cuotas.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 opacity-90">
              <li>
                <strong>Planes de cuotas (Recargos):</strong> Definí el interés o recargo que se aplicará automáticamente a cada cantidad de cuotas (ej. 10% para 3 cuotas, 20% para 6 cuotas).
              </li>
              <li>
                <strong>Base de cálculo:</strong> Establecé qué porcentaje del valor del producto se tomará como base para calcular las cuotas.
              </li>
              <li>
                <strong>Requisitos y Condiciones:</strong> Guardá condiciones estándar (como anticipos mínimos o requisitos del cliente) que se sugerirán automáticamente.
              </li>
            </ul>
            <p className="font-medium bg-sky-100 dark:bg-sky-900/40 p-2.5 rounded-lg border border-sky-200 dark:border-sky-800/50 mt-4">
              💡 <strong>¿Qué pasa al crear un producto?</strong> Cuando marques un producto como "Habilitar venta a crédito", el sistema copiará toda esta configuración automáticamente. Podrás dejarla tal cual para ahorrar tiempo, o modificarla individualmente solo para ese producto si necesitás una excepción.
            </p>
          </div>
        </div>

        <ProductCreditDefaultsEditor />
      </div>
    </RouteGuard>
  )
}
