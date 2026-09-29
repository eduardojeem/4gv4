'use client'

import { forwardRef } from 'react'
import Image, { type ImageProps } from 'next/image'
import { shouldBypassImageOptimization } from '@/lib/images'

export type AppImageProps = Omit<ImageProps, 'height' | 'width'> & {
  height?: ImageProps['height']
  width?: ImageProps['width']
}

export const AppImage = forwardRef<HTMLImageElement, AppImageProps>(function AppImage(
  { alt, height = 1, unoptimized, width = 1, src, ...props },
  ref,
) {
  // Antes esto forzaba unoptimized=true siempre, asi que ningun consumidor de
  // AppImage se beneficiaba del optimizador de Next salvo que lo pisara a
  // mano (como ya hacen ProductCard, MarketplaceProductModal, etc.). El
  // default ahora usa la misma politica que esos call sites: solo bypassea
  // para data:/blob:/SVG o hosts ya optimizados, y deja que Next optimice el
  // resto. Quien pase `unoptimized` explicitamente sigue mandando.
  const resolvedUnoptimized = unoptimized ?? (typeof src === 'string' ? shouldBypassImageOptimization(src) : false)
  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      ref={ref}
      height={height}
      width={width}
      unoptimized={resolvedUnoptimized}
    />
  )
})
