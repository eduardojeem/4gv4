'use client'

import { forwardRef } from 'react'
import Image, { type ImageProps } from 'next/image'

export type AppImageProps = Omit<ImageProps, 'height' | 'width'> & {
  height?: ImageProps['height']
  width?: ImageProps['width']
}

export const AppImage = forwardRef<HTMLImageElement, AppImageProps>(function AppImage(
  { alt, height = 1, unoptimized = true, width = 1, ...props },
  ref,
) {
  return (
    <Image
      {...props}
      alt={alt}
      ref={ref}
      height={height}
      width={width}
      unoptimized={unoptimized}
    />
  )
})
