import Link from 'next/link'
import { ArrowRight, Sparkles, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type PlatformBranding } from '@/lib/platform/branding'

export function SaaSCTASection({ branding }: { branding: PlatformBranding }) {
  return (
    <section className="relative overflow-hidden border-t border-slate-800 bg-slate-950 py-16 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(6,182,212,0.15),transparent)] pointer-events-none" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-300 mb-3">
            <Sparkles className="h-3 w-3 text-cyan-400" />
            Comenzá en menos de 2 minutos
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            ¿Listo para digitalizar y ordenar tu empresa?
          </h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-300">
            Registrá tu negocio hoy y comenzá con POS, inventario de productos y servicios, taller y catálogo público desde una plataforma moderna.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row shrink-0">
          <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20 text-sm rounded-xl h-12 px-6">
            <Link href={branding.primaryCtaHref}>
              {branding.primaryCtaLabel || 'Crear Cuenta Gratis'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white text-sm rounded-xl h-12 px-6">
            <Link href="/saas/planes">
              Ver Todos los Planes
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
