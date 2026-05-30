import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SaaSCTASection() {
  return (
    <section className="border-t border-slate-200 bg-slate-950 py-14 text-white dark:border-slate-800">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">Listo para crear tu empresa?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Registra tu negocio y empieza con POS, inventario y catalogo publico desde una base ordenada.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="gap-2 bg-white text-slate-950 hover:bg-slate-100">
            <Link href="/register">
              Crear empresa
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            <Link href="/marketplace">Explorar marketplace</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
