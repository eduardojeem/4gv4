import type { ComponentType, ReactNode } from 'react'

/**
 * Encabezado común de las secciones de SuperAdmin: qué es la página y qué se
 * puede hacer en ella, en una frase, más las acciones principales a la derecha.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-border/70 pb-6 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-card text-primary"><Icon className="h-5 w-5" aria-hidden /></div>
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 md:max-w-[45%] md:justify-end">{actions}</div>}
    </header>
  )
}

/** Aviso inline (errores de carga, advertencias). */
export function Notice({ tone = 'warning', children }: { tone?: 'warning' | 'error' | 'info'; children: ReactNode }) {
  const tones = {
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200',
    info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200',
  }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  )
}
