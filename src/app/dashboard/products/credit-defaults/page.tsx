'use client'

import { useAuth } from '@/contexts/auth-context'

import Link from 'next/link'
import { ArrowLeft, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RouteGuard } from '@/components/auth/permission-guard'
import { ProductCreditDefaultsEditor } from '@/components/dashboard/products/ProductCreditDefaultsEditor'

export default function ProductCreditDefaultsPage() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user?.role !== 'super_admin' && !['owner', 'admin'].includes(user?.organization?.role ?? '')) return <p role="alert" className="rounded-xl border p-6 text-sm">Solo el dueño o un administrador del comercio puede consultar y editar los predeterminados de crédito.</p>

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

        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">Configurá los planes de productos y las reglas del POS. Los cambios no actualizan productos existentes.</p>

        <details className="text-sm text-muted-foreground"><summary className="w-fit cursor-pointer py-2 font-medium text-primary">Qué se copia y qué solo se simula</summary><p className="mt-2 max-w-3xl leading-relaxed">Al elegir predeterminados se copian cantidad de cuotas, recargo o monto fijo y visibilidad. La base de costo y la entrega del ejemplo solo sirven para simular: no cambian lo que se financia en una venta.</p></details>

        <ProductCreditDefaultsEditor key={user?.organization?.id ?? user?.id} />
      </div>
    </RouteGuard>
  )
}
