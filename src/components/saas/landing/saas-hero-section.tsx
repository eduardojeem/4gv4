import Link from 'next/link'
import { ArrowRight, Boxes, ExternalLink, ShieldCheck, ShoppingCart, Wrench, Sparkles, CheckCircle2, ReceiptText, Building2, Store } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { type PlatformBranding } from '@/lib/platform/branding'
import { trustItems } from './saas-landing-data'
import { SaaSBrandAssistant } from './saas-brand-assistant'

export function SaaSHeroSection({ branding }: { branding: PlatformBranding }) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white dark:border-slate-800">
      {/* Dynamic radial glow background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,rgba(6,182,212,0.18),transparent)] pointer-events-none" />
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative mx-auto grid min-h-[600px] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        
        {/* Left Column: Headline, Copy & CTAs */}
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/70 py-1 pl-1.5 pr-3 text-xs font-semibold text-cyan-300 shadow-md backdrop-blur-md">
              {branding.faviconUrl || branding.logoDarkUrl || branding.logoUrl ? (
                <img
                  src={branding.faviconUrl || branding.logoDarkUrl || branding.logoUrl}
                  alt={branding.platformName}
                  className="h-5 w-5 rounded-full object-contain bg-slate-900/80 p-0.5 border border-cyan-500/40"
                />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              )}
              <span>{branding.platformName} · SaaS Multiempresa</span>
            </div>
            <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-300 text-xs px-2.5 py-0.5">
              📦 Físicos + ⚙️ Servicios
            </Badge>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white leading-tight">
            Administrá tu negocio <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">sin complicaciones</span>.
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-300">
            Creá tu empresa en minutos, controlá tu inventario físico, gestioná servicios profesionales, vendé en caja diaria y atendé reparaciones técnicas desde un panel seguro y 100% aislado.
          </p>

          <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
            <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/25 transition-all text-sm rounded-xl h-12 px-6">
              <Link href={branding.primaryCtaHref}>
                {branding.primaryCtaLabel || 'Empezar Prueba Gratis'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white rounded-xl h-12 px-6 text-sm">
              <Link href={branding.secondaryCtaHref || '/marketplace/empresas'}>
                <Store className="h-4 w-4" />
                {branding.secondaryCtaLabel || 'Explorar Empresas'}
              </Link>
            </Button>
          </div>

          {/* Trust bullet items */}
          <div className="mt-10 grid gap-3 sm:grid-cols-3 pt-6 border-t border-white/10">
            {trustItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 text-xs text-slate-300">
                <item.icon className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Live Operation Interactive Preview Card */}
        <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 text-slate-50 shadow-2xl backdrop-blur-xl relative">
          
          {/* Header of the mock panel with official brand logo */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-3">
              {branding.logoDarkUrl || branding.logoUrl ? (
                <div className="flex h-8 items-center bg-slate-950/80 px-2.5 py-1 rounded-lg border border-cyan-500/20 shadow-xs">
                  <img
                    src={branding.logoDarkUrl || branding.logoUrl}
                    alt={branding.platformName}
                    className="h-6 w-auto max-w-[120px] object-contain"
                  />
                </div>
              ) : (
                <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              )}
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Panel Central</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/40 text-emerald-400 bg-emerald-950/40 font-semibold">
                    En Vivo
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-400">Sucursal Central · Caja Activa</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Building2 className="h-4 w-4 text-cyan-400" />
              <span>Multi-tenant</span>
            </div>
          </div>

          {/* Key modules preview list */}
          <div className="space-y-3">
            {/* POS & Cash Module */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3.5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Punto de Venta (POS)</div>
                  <div className="text-[11px] text-slate-400">Ventas, turnos y tickets</div>
                </div>
              </div>
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px]">
                Caja y turnos
              </Badge>
            </div>

            {/* Inventory: Products & Services */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3.5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Inventario Unificado</div>
                  <div className="text-[11px] text-slate-400">📦 Productos físicos + ⚙️ Servicios</div>
                </div>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                Multi-sucursal
              </Badge>
            </div>

            {/* Repairs Module */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3.5 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-950/80 text-amber-400 border border-amber-500/30">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Taller & Reparaciones</div>
                  <div className="text-[11px] text-slate-400">Órdenes con seguimiento público</div>
                </div>
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                Seguimiento en línea
              </Badge>
            </div>
          </div>

          <SaaSBrandAssistant />

          {/* Bottom highlight bar */}
          <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ReceiptText className="h-3.5 w-3.5 text-slate-300" />
              <span>Ventas · Caja · Inventario · Reparaciones</span>
            </div>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              RLS Seguro
            </span>
          </div>

        </div>

      </div>
    </section>
  )
}
