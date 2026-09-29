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
  const resolvedUnoptimized = unoptimized
    ?? (typeof src === 'string' ? shouldBypassImageOptimization(src) : false)

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
