import { paletteFromPixels, type StorefrontBrandPalette } from './brand-palette'

/** Uses an anonymous browser image request; remote logos must allow CORS. */
export async function paletteFromLogo(src: string): Promise<StorefrontBrandPalette> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => { image.src = ''; reject(new Error('No pudimos leer el logo. Probá subir una imagen desde tu equipo.')) }, 8000)
    image.onload = () => { clearTimeout(timer); resolve() }
    image.onerror = () => { clearTimeout(timer); reject(new Error('El logo no permite leer sus colores. Podés subir una imagen desde tu equipo.')) }
  })
  image.src = src
  await loaded
  const canvas = document.createElement('canvas')
  canvas.width = 48; canvas.height = 48
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Tu navegador no permite analizar esta imagen.')
  try {
    const scale = Math.min(48 / image.naturalWidth, 48 / image.naturalHeight)
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale
    context.drawImage(image, (48 - width) / 2, (48 - height) / 2, width, height)
    return paletteFromPixels(context.getImageData(0, 0, 48, 48).data)
  } catch { throw new Error('No pudimos leer los colores. Probá subir un PNG o JPG desde tu equipo.') }
}
