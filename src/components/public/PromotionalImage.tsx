'use client'

import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { AppImage, type AppImageProps } from '@/components/ui/app-image'
import { cn } from '@/lib/utils'
import { isOptimizedPromotionalTemplate, resolvePromotionalTemplateImage } from '@/lib/website/promotional-images'

type Props = AppImageProps & { showFailureMessage?: boolean; compactFailure?: boolean }

export function PromotionalImage({ src, alt, onError, unoptimized, showFailureMessage = true, compactFailure = false, ...props }: Props) {
  const source = typeof src === 'string' ? resolvePromotionalTemplateImage(src) : src
  const [failedSource, setFailedSource] = useState<Props['src'] | null>(null)
  const failed = failedSource === source || (typeof source === 'string' && !source.trim())

  if (failed) {
    return <div role="img" aria-label={`Imagen no disponible: ${alt || 'banner'}`} className={cn(
      'flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-center text-slate-200',
      compactFailure ? 'gap-1 p-1' : 'gap-2 p-3',
      props.fill ? 'absolute inset-0' : 'h-full w-full', props.className,
    )}>
      {showFailureMessage && <>
        {!compactFailure && <ImageOff className="h-5 w-5 shrink-0" aria-hidden="true" />}
        <span className={compactFailure?'text-[10px] leading-tight':'text-xs'}>{compactFailure?'Imagen no disponible':'No se pudo cargar la imagen'}</span>
        {typeof source === 'string' && source.trim() && <button type="button" aria-label="Reintentar imagen" className="min-h-11 rounded-md border border-white/25 px-2 text-xs hover:bg-white/10" onClick={event => { event.stopPropagation(); setFailedSource(null) }}>Reintentar</button>}
      </>}
    </div>
  }

  return <AppImage {...props} src={source} alt={alt}
    unoptimized={typeof source === 'string' && isOptimizedPromotionalTemplate(source) ? true : unoptimized}
    onError={event => { setFailedSource(source); onError?.(event) }}
  />
}