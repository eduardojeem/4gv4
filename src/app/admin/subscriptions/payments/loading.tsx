export default function SubscriptionPaymentLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 py-4 sm:py-8" aria-busy="true" aria-label="Verificando pago con Pagopar">
      <div className="h-9 w-44 animate-pulse rounded-md bg-muted" />
      <section className="space-y-5 rounded-xl border p-5 sm:p-6">
        <div className="flex gap-4">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-3"><div className="h-6 w-48 animate-pulse rounded bg-muted" /><div className="h-4 w-full animate-pulse rounded bg-muted" /><div className="h-4 w-3/4 animate-pulse rounded bg-muted" /></div>
        </div>
        <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="space-y-2"><div className="h-3 w-24 animate-pulse rounded bg-muted" /><div className="h-4 w-32 animate-pulse rounded bg-muted" /></div>)}
        </div>
      </section>
      <span className="sr-only">Consultando el estado reciente del pago.</span>
    </main>
  )
}
