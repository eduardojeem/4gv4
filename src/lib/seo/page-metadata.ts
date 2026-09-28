import type { Metadata } from 'next'

/** Ruta de la imagen generada por src/app/opengraph-image.tsx. */
export const OG_IMAGE_PATH = '/opengraph-image'

/**
 * Metadata de una página pública con título/descripción propios también para
 * Open Graph y Twitter. Sin esto, las previews de WhatsApp/redes heredaban el
 * título genérico del layout raíz. La imagen sale de src/app/opengraph-image.tsx.
 */
export function publicPageMetadata({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}): Metadata {
  // Un `openGraph` propio reemplaza por completo al del layout, incluida la
  // imagen generada por src/app/opengraph-image.tsx: hay que repetirla.
  const images = [{ url: OG_IMAGE_PATH, width: 1200, height: 630 }]
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: 'website', images },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE_PATH] },
  }
}
