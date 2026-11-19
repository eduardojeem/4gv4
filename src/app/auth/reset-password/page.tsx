import { Suspense } from 'react'
import ResetPasswordContent from './ResetPasswordContent'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950" role="status">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Validando tu enlace…</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

export const dynamic = 'force-dynamic'
