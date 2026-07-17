import { Suspense } from 'react'
import { Star, Loader2 } from 'lucide-react'
import { ReviewsManagement } from '@/components/admin/reviews/reviews-management'

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-md border bg-background p-3 text-yellow-600 dark:text-yellow-400">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">Reseñas</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Modera las opiniones de tus clientes. Aprueba, oculta o elimina reseñas enviadas desde tu página pública.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ReviewsManagement />
      </Suspense>
    </div>
  )
}
