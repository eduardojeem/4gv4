import { Suspense } from 'react'
import { Loader2, MessageSquareHeart, Sparkles } from 'lucide-react'
import { ReviewsManagement } from '@/components/admin/reviews/reviews-management'

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-r from-card via-card to-amber-500/5 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 shadow-xs">
              <MessageSquareHeart className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Opiniones y Reseñas
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <Sparkles className="h-3 w-3" />
                  Reputación
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Gestioná la reputación de tu negocio. Moderá, aprobá y destacá las valoraciones que envían tus clientes desde tu tienda online pública.
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
