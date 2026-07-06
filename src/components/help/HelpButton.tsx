'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'
import { HelpPanel } from './HelpPanel'
import { sectionGuides, systemGuide, type Guide } from './guides'
import { cn } from '@/lib/utils'

type GuideKey = keyof typeof sectionGuides | 'system'

interface HelpButtonProps {
  /** Qué guía mostrar. 'system' → guía completa, cualquier otra clave → guía de sección */
  guideKey?: GuideKey
  /** Guía personalizada inline (alternativa a guideKey) */
  guide?: Guide
  /** Tamaño del botón */
  size?: 'sm' | 'default'
  /** Mostrar etiqueta de texto junto al ícono */
  showLabel?: boolean
  /** Clases adicionales */
  className?: string
  /** Variante del botón */
  variant?: 'ghost' | 'outline' | 'secondary'
}

export function HelpButton({
  guideKey = 'system',
  guide,
  size = 'sm',
  showLabel = false,
  className,
  variant = 'ghost',
}: HelpButtonProps) {
  const [open, setOpen] = useState(false)

  const resolvedGuide: Guide =
    guide ?? (guideKey === 'system' ? systemGuide : sectionGuides[guideKey] ?? systemGuide)

  return (
    <>
      <Button
        variant={variant}
        size={showLabel ? size : 'icon'}
        className={cn(
          'shrink-0',
          !showLabel && 'h-8 w-8',
          showLabel && 'gap-1.5',
          className,
        )}
        onClick={() => setOpen(true)}
        aria-label="Abrir guía de ayuda"
        title="Guía de ayuda"
      >
        <HelpCircle className="h-4 w-4" />
        {showLabel && <span className="text-sm">Ayuda</span>}
      </Button>

      <HelpPanel open={open} onOpenChange={setOpen} guide={resolvedGuide} />
    </>
  )
}

// ─── Variante global para el Header ──────────────────────────────────────────
export function GlobalHelpButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-9 w-9 shrink-0', className)}
        onClick={() => setOpen(true)}
        aria-label="Guía del sistema"
        title="Guía del sistema"
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      <HelpPanel open={open} onOpenChange={setOpen} guide={systemGuide} />
    </>
  )
}
