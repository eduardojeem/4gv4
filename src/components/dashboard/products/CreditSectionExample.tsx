import type { ReactNode } from 'react'

export function CreditSectionExample({ section, children }: { section: string; children: ReactNode }) {
  return (
    <details className="rounded-lg border border-primary/15 bg-primary/5 px-3 text-xs sm:col-span-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-primary">
        Ejemplo: {section}
      </summary>
      <div className="space-y-2 pb-3 leading-relaxed text-muted-foreground">{children}</div>
    </details>
  )
}
