import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type PlatformBranding } from '@/lib/platform/branding'

export function SaaSCTASection({ branding }: { branding: PlatformBranding }) {
  return (
    <section className="relative overflow-hidden border-t border-slate-200 bg-slate-900 text-white dark:border-slate-800 dark:bg-slate-950 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(6,182,212,0.15),transparent)] pointer-events-none" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
            {branding.logoDarkUrl || branding.logoUrl ? (
              <div className="flex h-10 items-center">
                <img
                  src={branding.logoDarkUrl || branding.logoUrl}
                  alt={branding.platformName}
                  className="h-9 w-auto max-w-[180px] object-contain drop-shadow-[0_2px_14px_rgba(6,182,212,0.3)]"
                />
              </div>
            ) : null}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-300">
              <Sparkles className="h-3 w-3 text-cyan-400" />
              Tu próximo paso
            </div>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Dale más orden a tu negocio
          </h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-300">
            Creá tu organización, prepará tu catálogo y elegí las herramientas que acompañan tu forma de trabajar.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row shrink-0">
          <Button asChild size="lg" className="gap-2 bg-cyan-500 text-slate-950 hover:bg-cyan-400 dark:bg-cyan-400 dark:hover:bg-cyan-300 font-semibold text-sm h-12 px-6 shadow-md shadow-cyan-500/20">
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
