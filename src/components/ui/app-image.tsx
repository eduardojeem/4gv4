'use client'

import { forwardRef } from 'react'
import Image, { type ImageProps } from 'next/image'
import { shouldBypassImageOptimization } from '@/lib/images'

export type AppImageProps = Omit<ImageProps, 'height' | 'width'> & {
  height?: ImageProps['height']
  width?: ImageProps['width']
}

export const AppImage = forwardRef<HTMLImageElement, AppImageProps>(function AppImage(
  { alt, height, unoptimized, width, src, ...props },
  ref,
) {
  const hasUsableSizing = props.fill === true || (width != null && height != null)
  const resolvedUnoptimized = unoptimized
    ?? (!hasUsableSizing || (typeof src === 'string' ? shouldBypassImageOptimization(src) : false))
  const dimensions = props.fill ? {} : { height: height ?? 1, width: width ?? 1 }

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      ref={ref}
      {...dimensions}
      unoptimized={resolvedUnoptimized}
    />
  )
})
