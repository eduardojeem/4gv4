export type ImageUploadProfileName = 'product' | 'banner' | 'logo'

export type ImageUploadProfile = Readonly<{
  maxDimension: number
  targetBytes: number
  outputMime: 'image/webp'
  extension: 'webp'
  initialQuality: number
  minimumQuality: number
}>

export const PUBLIC_IMAGE_CACHE_CONTROL = '31536000'

export const IMAGE_UPLOAD_PROFILES: Readonly<
  Record<ImageUploadProfileName, ImageUploadProfile>
> = {
  product: {
    maxDimension: 1280,
    targetBytes: 200 * 1024,
    outputMime: 'image/webp',
    extension: 'webp',
    initialQuality: 0.8,
    minimumQuality: 0.5,
  },
  banner: {
    maxDimension: 1920,
    targetBytes: 400 * 1024,
    outputMime: 'image/webp',
    extension: 'webp',
    initialQuality: 0.82,
    minimumQuality: 0.55,
  },
  logo: {
    maxDimension: 512,
    targetBytes: 100 * 1024,
    outputMime: 'image/webp',
    extension: 'webp',
    initialQuality: 0.85,
    minimumQuality: 0.6,
  },
} as const

export function replaceImageExtension(name: string, extension: string): string {
  const normalizedExtension = extension.replace(/^\.+/, '').toLowerCase()
  const trimmedName = name.trim().replace(/^.*[\\/]/, '')
  const firstDot = trimmedName.indexOf('.')
  const baseName = (firstDot >= 0 ? trimmedName.slice(0, firstDot) : trimmedName) || 'image'

  return `${baseName}.${normalizedExtension}`
}
