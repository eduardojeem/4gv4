import { MetadataRoute } from 'next'
import { DEFAULT_PLATFORM_BRANDING, getPlatformBranding } from '@/lib/platform/branding'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let branding = DEFAULT_PLATFORM_BRANDING

  try {
    branding = await getPlatformBranding()
  } catch {
    branding = DEFAULT_PLATFORM_BRANDING
  }

  return {
    name: branding.platformName,
    short_name: branding.platformName.slice(0, 30),
    description: branding.seoDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
