'use client'
import { useId, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { MarketplacePlanCarousel } from './MarketplacePlanCarousel'
import { ArrowRight, CalendarDays, Check, CreditCard, Globe2, Layers3, MonitorSmartphone, ShieldCheck, Store, Users, Wrench } from 'lucide-react'
import { BUSINESS_PROMO_LINKS, BUSINESS_PROMO_PROFILES, type BusinessPromoIcon } from '@/lib/public/marketplace-business-promo'
const ICONS = { sales: CreditCard, stock: Layers3, catalog: Globe2, repair: Wrench, warranty: ShieldCheck, calendar: CalendarDays, customers: Users } satisfies Record<BusinessPromoIcon, typeof Store>
const subscribeHydration = () => () => {}
export function MarketplaceBusinessPromo() {
  const ready = useSyncExternalStore(subscribeHydration, () => true, () => false)
  const id = useId()
  const [selected, setSelected] = useState(0)
  const profile = BUSINESS_PROMO_PROFILES[selected]
  return <section aria-labelledby={id + '-title'} className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
    <div className="overflow-hidden rounded-[28px] border border-border/80 bg-card shadow-sm">
      <div className="grid lg:grid-cols-[1fr_1.05fr]">
        <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12">
          <div className="mb-5 inline-flex items-center gap-2 self-start rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-foreground"><Store aria-hidden="true" size={14} className="text-primary"/> Para tu negocio</div>
          <h2 id={id + '-title'} className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-[42px] lg:leading-[1.1]">Tu negocio,<span className="block text-muted-foreground">en un solo lugar.</span></h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">Herramientas para vender, organizar tu trabajo y acompañar a tus clientes. Elegí tu actividad y descubrí lo que podés hacer.</p>
          <div className="mt-5 flex items-center gap-2 text-xs font-medium text-muted-foreground"><MonitorSmartphone aria-hidden="true" size={17}/><span>Desde la app y la web</span></div>
        </div>
        <div className="border-t border-border/70 bg-muted/30 p-5 sm:p-8 lg:border-l lg:border-t-0 lg:p-9">
          <div role="tablist" aria-label="Tipo de negocio" aria-busy={!ready} className="flex gap-1 rounded-xl border border-border/60 bg-background/70 p-1">
            {BUSINESS_PROMO_PROFILES.map((item, index) => <button key={item.id} type="button" disabled={!ready} role="tab" id={id + '-' + item.id} aria-selected={selected === index} aria-controls={id + '-panel'} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => {
              let next: number
              if (event.key === 'ArrowRight') next = (index + 1) % BUSINESS_PROMO_PROFILES.length
              else if (event.key === 'ArrowLeft') next = (index + BUSINESS_PROMO_PROFILES.length - 1) % BUSINESS_PROMO_PROFILES.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = BUSINESS_PROMO_PROFILES.length - 1
              else return
              event.preventDefault(); setSelected(next); document.getElementById(id + '-' + BUSINESS_PROMO_PROFILES[next].id)?.focus()
            }} className={'disabled:cursor-wait disabled:opacity-60 min-h-11 min-w-0 flex-1 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm ' + (selected === index ? 'bg-card text-foreground shadow-sm ring-1 ring-border/70' : 'text-muted-foreground hover:bg-card/60 hover:text-foreground')}>{item.label}</button>)}
          </div>
          <div role="tabpanel" id={id + '-panel'} aria-labelledby={id + '-' + profile.id} tabIndex={0} className="mt-6 rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">
            <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{profile.title}</h3><p className="mt-1.5 min-h-10 text-sm leading-5 text-muted-foreground">{profile.description}</p>
            <div className="mt-4 divide-y divide-border/60">{profile.benefits.map(benefit => { const Icon = ICONS[benefit.icon]; return <div key={benefit.title} className="flex items-start gap-3 py-3.5"><span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card text-primary"><Icon aria-hidden="true" size={20}/></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{benefit.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{benefit.description}</p></div><Check aria-hidden="true" size={15} className="mt-2 shrink-0 text-primary/70"/></div> })}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t border-border/70 bg-background/40 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between"><p className="text-xs leading-relaxed text-muted-foreground">Elegí lo que necesitás.<span className="block">Las funciones y los límites dependen del plan.</span></p><div className="flex flex-col gap-2 sm:flex-row"><PromoLinks/></div></div>
    </div>
    <MarketplacePlanCarousel/>
  </section>
}
function PromoLinks() {
  return <><Link href={BUSINESS_PROMO_LINKS.web.plans} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Ver planes<ArrowRight aria-hidden="true" size={17}/></Link><Link href={BUSINESS_PROMO_LINKS.web.system} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Ver funciones</Link></>
}
