import { ImageResponse } from 'next/og'
import { DEFAULT_PLATFORM_BRANDING, getPlatformBranding } from '@/lib/platform/branding'

/**
 * Imagen de preview (og:image / twitter:image) para todas las rutas que no
 * definan la suya. Se genera con el nombre y la descripción de la marca
 * configurada en /superadmin/web-content/brand.
 */
export const alt = 'Vista previa de la plataforma'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600

export default async function OpenGraphImage() {
  let branding = DEFAULT_PLATFORM_BRANDING
  try {
    branding = await getPlatformBranding()
  } catch {
    branding = DEFAULT_PLATFORM_BRANDING
  }

  const description = (branding.seoDescription || branding.platformTagline || '').slice(0, 160)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #0e7490 0%, #1d4ed8 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, opacity: 0.85 }}>
          {branding.platformTagline}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>{branding.platformName}</div>
          {description && (
            <div style={{ display: 'flex', fontSize: 34, lineHeight: 1.35, opacity: 0.92, maxWidth: 1000 }}>{description}</div>
          )}
        </div>
        <div style={{ display: 'flex', fontSize: 26, opacity: 0.8 }}>POS · Inventario · Reparaciones · Marketplace</div>
      </div>
    ),
    size,
  )
}
