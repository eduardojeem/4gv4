/**
 * Lo que se ve mientras se arma la ficha.
 *
 * La ficha se calcula entera en el servidor —ventas, pedidos, reparaciones,
 * créditos, accesos— y en organizaciones grandes tarda. Sin esto, al entrar
 * desde la lista no pasaba nada hasta que terminaba.
 */
export default function OrganizationDetailLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Cargando la ficha de la organización…</span>

      <div className="h-14 animate-pulse rounded-2xl border border-border bg-card" />

      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="flex items-center gap-4 p-6">
          <div className="h-16 w-16 animate-pulse rounded-3xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-56 animate-pulse rounded bg-muted" />
            <div className="h-3 w-80 max-w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="grid border-t border-border sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2 p-5">
              <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      <div className="h-11 w-full max-w-2xl animate-pulse rounded-2xl border border-border bg-card" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    </div>
  )
}
