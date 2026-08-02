import { Skeleton } from '@/components/ui/skeleton'

export default function SuperAdminLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6" aria-label="Cargando sección">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-4 w-full max-w-xl rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="border-b p-4">
          <Skeleton className="h-9 w-full max-w-md rounded-md" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-11 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
