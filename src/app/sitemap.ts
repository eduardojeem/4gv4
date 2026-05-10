import { MetadataRoute } from 'next'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'

export const revalidate = 3600 // Revalidar cada hora

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://localhost:3000'
  const settings = await fetchWebsiteSettings()
  const lastMod = new Date().toISOString()

  // Public pages only — never include auth-protected routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/inicio`,
      lastModified: lastMod,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/productos`,
      lastModified: lastMod,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
  ]

  // If maintenance mode is on, return minimal sitemap
  if (settings?.maintenance_mode?.enabled) {
    return [
      {
        url: `${baseUrl}/inicio`,
        lastModified: lastMod,
        changeFrequency: 'daily',
        priority: 1.0,
      },
    ]
  }

  return staticRoutes
}
