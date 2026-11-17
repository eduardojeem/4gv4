'use client'

import { forwardRef, useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { shouldBypassImageOptimization } from '@/lib/images'

export type AppImageProps = Omit<ImageProps, 'height' | 'width'> & {
  height?: ImageProps['height']
  width?: ImageProps['width']
  fallbackSrc?: string
}

export const AppImage = forwardRef<HTMLImageElement, AppImageProps>(function AppImage(
  { alt, height, unoptimized, width, src, fallbackSrc = '/placeholder-product.svg', onError, ...props },
  ref,
) {
  const [hasError, setHasError] = useState(false)
  const currentSrc = hasError ? fallbackSrc : src
  const hasUsableSizing = props.fill === true || (width != null && height != null)
  const resolvedUnoptimized = unoptimized
    ?? (!hasUsableSizing || (typeof currentSrc === 'string' ? shouldBypassImageOptimization(currentSrc) : false))
  const dimensions = props.fill ? {} : { height: height ?? 1, width: width ?? 1 }

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      ref={ref}
      {...dimensions}
      unoptimized={resolvedUnoptimized}
      onError={(e) => {
        if (!hasError) {
          setHasError(true)
        }
        onError?.(e)
      }}
    />
  )
})
