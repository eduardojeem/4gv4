import { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  // Mismo dominio canónico que el resto de la app. NEXT_PUBLIC_BASE_URL
  // apuntaba en producción a un dominio anterior (servix360.org).
  const baseUrl = getSiteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/saas',
          '/marketplace',
          '/marketplace/empresas/',
          '/default/inicio',
          '/default/productos',
          '/default/productos/',
        ],
        disallow: [
          '/inicio',
          '/productos',
          '/productos/',
          '/products',
          '/products/',
          '/mis-reparaciones',
          '/mis-reparaciones/',
          '/*/mis-reparaciones',
          '/*/mis-reparaciones/',
          '/perfil',
          '/perfil/',
          '/dashboard',
          '/dashboard/',
          '/admin',
          '/admin/',
          '/superadmin',
          '/superadmin/',
          '/api/',
          '/auth/',
          '/login',
          '/register',
          '/setup',
          '/debug',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
