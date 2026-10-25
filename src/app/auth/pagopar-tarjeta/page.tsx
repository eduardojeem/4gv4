'use client'

import { useEffect } from 'react'

/**
 * Pagopar redirige acá al terminar el formulario de tarjeta de uPay, a veces
 * dentro de su iframe. Esta página no lee ni muestra datos: sale del iframe y
 * manda al panel, que es quien confirma la tarjeta con la sesión del usuario.
 */
export default function PagoparCardReturnPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status') === 'add_new_card_success' ? 'success' : 'fail'
    const target = `/admin/subscriptions/autopay?card=${status}`

    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = target
        return
      }
    } catch {
      // Si el navegador no deja tocar la ventana principal, se sigue acá.
    }
    window.location.replace(target)
  }, [])

  return (
    <main className="flex min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
      Volviendo al panel…
    </main>
  )
}
