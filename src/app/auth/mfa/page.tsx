import { Suspense } from 'react'
import type { Metadata } from 'next'
import MfaContent from './MfaContent'

export const metadata: Metadata = {
  title: 'Verificación en dos pasos',
  robots: { index: false, follow: false },
}

export default function MfaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <MfaContent />
    </Suspense>
  )
}

export const dynamic = 'force-dynamic'
