'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * «Arriba» flotante para listas largas. En el celular la barra de filtros ya
 * no queda fija, así que después de bajar 28 productos volver a los filtros
 * era deslizar varias pantallas.
 */
export function BackToTopButton({ targetId, threshold = 1200 }: { targetId?: string; threshold?: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const update = () => setVisible(window.scrollY > threshold)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [threshold])

  const goUp = () => {
    const target = targetId ? document.getElementById(targetId) : null
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={goUp}
      aria-label="Volver arriba"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        // Encima de la navegación de abajo del celular (64px).
        'fixed bottom-20 right-4 z-30 flex h-11 items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-4 text-xs font-bold text-foreground shadow-lg backdrop-blur transition-all lg:bottom-6',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      )}
    >
      <ArrowUp className="h-4 w-4" />
      Arriba
    </button>
  )
}
