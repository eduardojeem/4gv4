import { Suspense } from 'react'
import { BadgeCheck, Loader2, MessageSquareHeart } from 'lucide-react'
import { ReviewsManagement } from '@/components/admin/reviews/reviews-management'

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-border/70 bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquareHeart className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Reputación y opiniones
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <BadgeCheck className="h-3 w-3" />
                  Confianza verificable
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Respondé a tus clientes, comprobá experiencias reales y moderá contenido con motivos transparentes. La opinión del cliente nunca se edita.
              </p>
            </div>
          </div>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed bg-muted/20">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Cargando reseñas...</span>
            </div>
          </div>
        }
      >
        <ReviewsManagement />
      </Suspense>
    </div>
  )
}
