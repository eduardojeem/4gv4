import type { ReactNode } from 'react'

type POSWorkspaceProps = {
  catalog: ReactNode
  cart: ReactNode
  statusMessage?: string
}

export function POSWorkspace({ catalog, cart, statusMessage }: POSWorkspaceProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-muted/5">
      <section aria-label="Catálogo" className="flex min-h-0 min-w-0 flex-1">
        {catalog}
      </section>
      <aside aria-label="Carrito" className="contents">
        {cart}
      </aside>
      <div role="status" aria-live="polite" className="sr-only">{statusMessage}</div>
    </div>
  )
}
