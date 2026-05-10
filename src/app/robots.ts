import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://localhost:3000'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/inicio',
          '/productos',
          '/productos/',
        ],
        disallow: [
          '/mis-reparaciones',
          '/mis-reparaciones/',
          '/perfil',
          '/perfil/',
          '/dashboard',
          '/dashboard/',
          '/admin',
          '/admin/',
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
