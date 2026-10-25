import { REMOTE_IMAGE_HOSTS } from '../../image-hosts'

const remoteImageHosts = new Set<string>(REMOTE_IMAGE_HOSTS)

function isLocalDevelopmentProductImage(url: URL): boolean {
  if (process.env.NODE_ENV !== 'development'
    || url.protocol !== 'http:'
    || url.port !== '55321'
    || url.username !== ''
    || url.password !== ''
    || !url.pathname.startsWith('/storage/v1/object/public/dev-product-images/dev-fixtures/products/')) {
    return false
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.')) return true

  const octets = hostname.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
}

export function isSupportedImageSource(value: string): boolean {
  const source = value.trim()
  if (!source) return false

  if (source.startsWith('/') || source.startsWith('product-images/')) return true
  if (source.startsWith('data:image/')) return true
  if (source.startsWith('blob:')) return true

  try {
    const url = new URL(source)
    if (isLocalDevelopmentProductImage(url)) return true
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
  if (isSupportedImageSource(source)) return null

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
