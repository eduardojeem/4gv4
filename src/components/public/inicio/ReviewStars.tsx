'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ReviewStars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} de 5 estrellas`} role="img">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn(sizeClass, star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25')}
        />
      ))}
    </span>
  )
}

export function ReviewStarsInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Tu calificación">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} estrella${star === 1 ? '' : 's'}`}
          onClick={() => onChange(star)}
          className="rounded p-0.5 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className={cn('h-7 w-7', star <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
        </button>
      ))}
    </div>
  )
}
