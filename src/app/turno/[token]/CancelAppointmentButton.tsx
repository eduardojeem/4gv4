'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CancelAppointmentButton({ token }: { token: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancel = async () => {
    if (!window.confirm('¿Cancelar el turno? El horario queda libre para otra persona.')) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/public/appointment/${token}`, { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error || 'No se pudo cancelar')
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void cancel()}
        disabled={busy}
        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? 'Cancelando…' : 'Cancelar el turno'}
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </>
  )
}
