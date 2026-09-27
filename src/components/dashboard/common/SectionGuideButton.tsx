'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionGuideModal, type SectionGuideData } from './SectionGuideModal'

interface SectionGuideButtonProps {
  guide: SectionGuideData
  buttonLabel?: string
  variant?: 'outline' | 'ghost' | 'secondary' | 'default'
  size?: 'sm' | 'default' | 'icon'
  className?: string
}

export function SectionGuideButton({
  guide,
  buttonLabel = '¿Cómo funciona?',
  variant = 'outline',
  size = 'sm',
  className
}: SectionGuideButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={cn(
          'gap-1.5 font-semibold text-xs transition-colors',
          variant === 'outline' && 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800',
          className
        )}
        title={guide.title}
      >
        <HelpCircle className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        {buttonLabel && <span>{buttonLabel}</span>}
      </Button>

      <SectionGuideModal
        open={open}
        onOpenChange={setOpen}
        guide={guide}
      />
    </>
  )
}
