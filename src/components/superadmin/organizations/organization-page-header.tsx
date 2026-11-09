import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'
export function OrganizationPageHeader({ title, description, back, actions }: { title: string; description: string; back?: boolean; actions?: ReactNode }) {
  return <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
    <div className="min-w-0 space-y-3">{back ? <Link href="/superadmin/organizations" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden size={16}/> Organizaciones</Link> : <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><Building2 aria-hidden size={15}/> Administración de empresas</p>}
      <h1 className="break-words text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1><p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>{actions && <div className="flex shrink-0 flex-wrap items-center gap-2 [&_button]:min-h-11 [&_a]:min-h-11">{actions}</div>}
  </header>
}
export function OrganizationSectionNav({ sections }: { sections: { id: string; title: string; hint: string }[] }) {
  return <nav aria-label="Secciones del formulario" className="grid gap-2 rounded-2xl border border-border bg-muted/30 p-3 sm:grid-cols-2 xl:grid-cols-4">{sections.map((section, index) => <a key={section.id} href={'#' + section.id} className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-card focus-visible:outline-primary"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-bold text-primary">{index + 1}</span><span><span className="block text-sm font-semibold text-foreground">{section.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{section.hint}</span></span></a>)}</nav>
}
