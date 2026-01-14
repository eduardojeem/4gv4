import { Suspense } from 'react'
import ResetPasswordContent from './ResetPasswordContent'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/30">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Cargando...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

export const dynamic = 'force-dynamic'
