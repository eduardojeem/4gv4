// Shown by Next.js App Router while the server component (page.tsx) is fetching.
// Mirrors the productos page layout so the transition is seamless.

export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Title bar skeleton */}
      <div className="border-b border-border/40 bg-muted/20">
        <div className="container py-6">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <div className="h-8 w-52 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-36 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-10 w-full max-w-sm rounded-lg bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      <div className="container py-6 lg:py-8">
        <div className="flex gap-6 xl:gap-8">
          {/* Sidebar skeleton — desktop only */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3.5 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-8 w-full rounded-lg bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          </aside>

          {/* Product grid skeleton */}
          <div className="flex-1 min-w-0">
            {/* Toolbar skeleton */}
            <div className="mb-5 rounded-2xl border border-border/60 bg-card/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="h-9 w-24 rounded-lg bg-muted animate-pulse lg:hidden" />
                <div className="h-9 w-36 rounded-lg bg-muted animate-pulse ml-auto" />
              </div>
            </div>

            {/* Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
                >
                  {/* Image placeholder */}
                  <div className="aspect-square bg-muted animate-pulse" />
                  {/* Info */}
                  <div className="flex flex-col gap-2 px-3.5 pb-3.5 pt-3">
                    <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-full rounded bg-muted animate-pulse" />
                    <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="mt-1 h-5 w-28 rounded bg-muted animate-pulse" />
                    <div className="mt-2 flex gap-2">
                      <div className="h-9 flex-1 rounded-xl bg-muted animate-pulse" />
                      <div className="h-9 flex-1 rounded-xl bg-muted animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
