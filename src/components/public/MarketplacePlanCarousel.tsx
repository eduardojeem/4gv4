'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Building2, Store } from 'lucide-react'
import { planAudiences, planPrice, planRegistrationPath, type MarketplacePlan } from '@/lib/public/marketplace-plan'

export function MarketplacePlanCarousel() {
  const [plans, setPlans] = useState<MarketplacePlan[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [active, setActive] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const region = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(true)
  useEffect(() => {
    if (!window.matchMedia) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    update()
    preference.addEventListener('change', update)
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting ?? false), { threshold: .15 })
    if (region.current) observer.observe(region.current)
    return () => { preference.removeEventListener('change', update); observer.disconnect() }
  }, [])
  useEffect(() => {
    if (paused || hovered || reducedMotion || !visible || plans.length < 2) return
    const timer = window.setInterval(() => {
      if (document.hidden) return
      const element = track.current
      const first = element?.firstElementChild as HTMLElement | null
      const next = element?.children[(active + 1) % plans.length] as HTMLElement | undefined
      if (element && first && next) element.scrollTo({ left: next.offsetLeft - first.offsetLeft, behavior: 'smooth' })
    }, 8000)
    return () => window.clearInterval(timer)
  }, [active, paused, hovered, reducedMotion, visible, plans.length])
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/mobile/saas', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('catalog')
      const data = await response.json()
      if (!Array.isArray(data.plans)) throw new Error('catalog')
      if (!controller.signal.aborted) { setPlans(data.plans); setStatus('ready') }
    }).catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [attempt])
  function goTo(index: number) {
    setPaused(true)
    const element = track.current
    const card = element?.children[index] as HTMLElement | undefined
    if (element && card) element.scrollTo({ left: card.offsetLeft - (element.firstElementChild as HTMLElement).offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  return <div ref={region} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={event => { if (!(event.target as HTMLElement).closest('[data-motion-control]')) setPaused(true) }} className="mt-8" role="region" aria-label="Planes para tu negocio" aria-roledescription="carrusel">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Un plan para tu próximo paso</p><h3 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Tu empresa empieza acá.</h3><p className="mt-2 text-sm text-muted-foreground">Conocé cada opción y elegí cómo querés crecer.</p></div><Link href="/saas#planes" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Comparar planes <ArrowRight aria-hidden size={16}/></Link></div>
    {status === 'loading' && <p role="status" className="rounded-3xl border border-border p-8 text-muted-foreground">Consultando planes disponibles…</p>}
    {status === 'error' && <div role="alert" className="rounded-3xl border border-border p-8"><p>No pudimos consultar los planes.</p><button className="mt-3 min-h-11 font-semibold text-primary" onClick={() => { setStatus('loading'); setAttempt(value => value + 1) }}>Volver a intentar</button></div>}
    {status === 'ready' && !plans.length && <p className="p-6 text-muted-foreground">No hay planes publicados en este momento.</p>}
    {plans.length > 0 && <>
      <div ref={track} onPointerDown={() => setPaused(true)} tabIndex={0} aria-label="Deslizá para ver todos los planes" onScroll={event => {
        const element = event.currentTarget
        const first = element.firstElementChild as HTMLElement | null
        if (!first) return
        const step = first.getBoundingClientRect().width + 16
        setActive(Math.min(plans.length - 1, Math.max(0, Math.round(element.scrollLeft / step))))
      }} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); goTo(Math.max(0, Math.min(plans.length - 1, active + (event.key === 'ArrowRight' ? 1 : -1)))) } }} className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto rounded-[28px] pb-2 [scrollbar-width:none] focus-visible:outline-primary">
        {plans.map((plan, index) => <article key={plan.id} aria-label={'Plan ' + plan.name} aria-roledescription="diapositiva" className="grid w-full min-w-0 shrink-0 snap-start overflow-hidden rounded-[28px] border border-border bg-card lg:grid-cols-[1.1fr_1fr]">
          <div className="relative flex min-w-0 flex-col overflow-hidden bg-slate-950 p-6 text-white sm:p-9 lg:p-10">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full border-[36px] border-blue-500/10"/>
            <div className="relative"><div className="flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200"><Store aria-hidden size={14}/> Para tu empresa</span><span className="text-xs font-semibold text-slate-300">{plan.is_popular ? 'PLAN DESTACADO' : 'PLAN ' + String(index + 1).padStart(2, '0')}</span></div>
              <h4 className="mt-6 break-words text-4xl font-extrabold tracking-tight sm:text-5xl">{plan.name}</h4><p className="mt-3 max-w-md text-sm leading-6 text-slate-300 sm:text-base">{plan.description || 'Conocé las herramientas incluidas para gestionar tu negocio.'}</p>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-widest text-slate-400">Para qué negocios sirve</p><div className="mt-2 flex flex-wrap gap-2">{planAudiences(plan).map(label => <span key={label} className="rounded-lg border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-100">{label}</span>)}{planAudiences(plan).length === 0 && <span className="text-sm text-slate-300">Consultá las funciones incluidas.</span>}</div>
              <div className="mt-7 border-t border-white/10 pt-5"><p className="break-words text-4xl font-extrabold tracking-tight sm:text-5xl">{planPrice(plan)}</p>{plan.price_note && <p className="mt-2 text-sm text-slate-300">{plan.price_note}</p>}{plan.trial_days > 0 && <p className="mt-4 inline-flex rounded-full bg-blue-400/15 px-3 py-1.5 text-xs font-bold text-blue-100">{plan.trial_days} días de prueba</p>}</div>
            </div>
          </div>
          <div className="flex min-w-0 flex-col p-6 sm:p-9 lg:p-10"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Lo que incluye tu plan</p><dl className="mt-5 grid grid-cols-2 gap-3">{plan.limits.slice(0, 4).map(limit => <div key={limit.key} className="min-w-0 rounded-xl border border-border/70 bg-muted/30 p-3"><dt className="text-xs text-muted-foreground">{limit.label}</dt><dd className="mt-1 break-words text-xl font-bold text-foreground">{limit.value}</dd></div>)}</dl>
            <ul className="mb-7 mt-5 space-y-3">{plan.features.slice(0, 3).map(feature => <li key={feature.key} className="flex items-start gap-2 text-sm text-foreground"><Check aria-hidden size={17} className="mt-0.5 shrink-0 text-primary"/>{feature.label}</li>)}</ul>
            <Link href={planRegistrationPath(plan)} aria-label={'Registrar mi empresa con ' + plan.name} className="mt-auto flex min-h-12 items-center justify-center gap-3 rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90">Registrar mi empresa <ArrowRight aria-hidden size={17}/></Link><p className="mt-3 text-center text-xs text-muted-foreground">Empezás con el plan {plan.name} seleccionado.</p>
          </div>
        </article>)}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3"><button type="button" disabled={active === 0} aria-label="Plan anterior" onClick={() => goTo(active - 1)} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground disabled:opacity-30"><ArrowLeft aria-hidden size={18}/></button><div className="flex flex-wrap items-center justify-center gap-1">{plans.map((plan, index) => <button type="button" key={plan.id} onClick={() => goTo(index)} aria-label={'Ver plan ' + plan.name} aria-current={active === index ? 'true' : undefined} className="flex size-11 items-center justify-center"><span className={'h-2 rounded-full transition-all ' + (active === index ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/35')}/></button>)}<span className="sr-only" aria-live={paused || reducedMotion ? 'polite' : 'off'}>Plan {active + 1} de {plans.length}</span></div><button type="button" disabled={active === plans.length - 1} aria-label="Plan siguiente" onClick={() => goTo(active + 1)} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground disabled:opacity-30"><ArrowRight aria-hidden size={18}/></button></div>
    </>}
    {plans.length > 1 && !reducedMotion && <div className="mt-1 flex justify-center"><button type="button" data-motion-control aria-pressed={!paused} onClick={() => setPaused(value => !value)} className="min-h-11 rounded-lg px-4 text-xs font-semibold text-muted-foreground hover:text-foreground">{paused ? '▶ Reanudar movimiento' : 'Ⅱ Pausar movimiento'}</button></div>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-5 py-4"><div className="flex items-center gap-3"><Building2 aria-hidden size={20} className="shrink-0 text-muted-foreground"/><div><p className="text-sm font-semibold text-foreground">¿Ya tenés una empresa registrada?</p><p className="mt-1 text-xs text-muted-foreground">Ingresá con tu cuenta para seguir gestionándola.</p></div></div><Link href="/login" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary">Ya tengo una empresa · Ingresar <ArrowRight aria-hidden size={16}/></Link></div>
  </div>
}
