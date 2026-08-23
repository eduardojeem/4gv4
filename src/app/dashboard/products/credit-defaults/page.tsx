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
            <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Definí una sola vez la base de cálculo, las condiciones y los planes. Al activar cuotas
              en un producto vas a poder usarlos tal cual o cargar unos nuevos desde cero.
            </p>
          </div>
        </header>

        <ProductCreditDefaultsEditor />
      </div>
    </RouteGuard>
  )
}
