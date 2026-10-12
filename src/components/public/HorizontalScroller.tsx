'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Franja horizontal que se puede recorrer con cualquier cosa.
 *
 * Las categorías del catálogo estaban en un `overflow-x-auto` con la barra
 * escondida: en el celular se arrastra con el dedo, pero en la computadora la
 * rueda del mouse solo mueve la página para abajo y dos tercios de las
 * categorías quedaban fuera de alcance. Acá la rueda mueve la franja, hay
 * flechas cuando queda algo escondido, y el elemento marcado con
 * `data-active="true"` se trae a la vista cuando cambia lo elegido.
 */
export function HorizontalScroller({
  children,
  className,
  label,
  activeKey,
}: {
  children: ReactNode
  className?: string
  /** Para lectores de pantalla y las flechas: «categorías», «ramas». */
  label: string
  /** Cambia cuando cambia lo elegido: solo entonces se lo trae a la vista. */
  activeKey?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const active = el.querySelector<HTMLElement>('[data-active="true"]')
    if (active) {
      // Solo en horizontal: `scrollIntoView` movería también la página.
      el.scrollLeft = Math.max(0, active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2)
    }
    update()
  }, [activeKey, update])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // La rueda vertical mueve la franja mientras tenga para dónde ir; al
    // llegar al borde, la página sigue bajando como siempre.
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      if ((event.deltaY < 0 && el.scrollLeft <= 0) || (event.deltaY > 0 && el.scrollLeft >= max - 1)) return
      event.preventDefault()
      el.scrollLeft = Math.min(max, Math.max(0, el.scrollLeft + event.deltaY))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    observer?.observe(el)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [update])

  const move = (direction: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  const arrow = 'absolute top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background text-foreground shadow-sm transition-colors hover:bg-muted sm:flex'

  return (
    <div className="relative min-w-0">
      {canLeft && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-10 bg-gradient-to-r from-background to-transparent" />
          <button type="button" onClick={() => move(-1)} aria-label={`Ver ${label} anteriores`} className={cn(arrow, 'left-0')}>
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      )}
      <div ref={ref} role="group" aria-label={label} className={cn('overflow-x-auto scrollbar-hide', className)}>
        {children}
      </div>
      {canRight && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-10 bg-gradient-to-l from-background to-transparent" />
          <button type="button" onClick={() => move(1)} aria-label={`Ver más ${label}`} className={cn(arrow, 'right-0')}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}
