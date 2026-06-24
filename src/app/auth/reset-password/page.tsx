import { Suspense } from 'react'
import ResetPasswordContent from './ResetPasswordContent'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 blur-xl bg-blue-500/30 rounded-full" />
            <div className="h-10 w-10 animate-spin border-2 border-blue-500 border-t-transparent rounded-full relative z-10" />
          </div>
          <p className="text-sm font-medium text-slate-400 tracking-wide">Cargando interfaz...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

export const dynamic = 'force-dynamic'
