'use client'

import { Button } from '@/components/ui/button'

export default function MarketplaceError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto flex min-h-[45vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">No pudimos cargar el marketplace</h1>
      <p className="text-muted-foreground">El catálogo está temporalmente no disponible. Intentá nuevamente en unos momentos.</p>
      <Button onClick={reset} className="min-h-11">Reintentar</Button>
    </section>
  )
}
