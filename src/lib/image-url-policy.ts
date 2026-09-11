import { REMOTE_IMAGE_HOSTS } from '../../image-hosts'

const remoteImageHosts = new Set<string>(REMOTE_IMAGE_HOSTS)

export function isSupportedImageSource(value: string): boolean {
  const source = value.trim()
  if (!source) return false

  if (source.startsWith('/') || source.startsWith('product-images/')) return true
  if (source.startsWith('data:image/')) return true
  if (source.startsWith('blob:')) return true

  try {
    const url = new URL(source)
    return url.protocol === 'https:' && remoteImageHosts.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function isPersistableImageSource(value: string): boolean {
  return !value.trim().startsWith('blob:') && isSupportedImageSource(value)
}

export function getImageSourceValidationMessage(value: string): string | null {
  const source = value.trim()
  if (!source) return 'Ingresá una URL de imagen.'

  try {
    const url = new URL(source)
    if (url.protocol !== 'https:') return 'La imagen externa debe usar una URL segura https://.'
    if (!remoteImageHosts.has(url.hostname.toLowerCase())) {
      return `El dominio ${url.hostname} no está habilitado para imágenes.`
    }
    return null
  } catch {
    return isSupportedImageSource(source)
      ? null
      : 'Ingresá una URL completa https:// o una ruta de imagen válida.'
  }
}
