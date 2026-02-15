import { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
const COMPANY_NAME = '4G Celulares'

interface SEOConfig {
  title: string
  description: string
  keywords?: string[]
  image?: string
  url?: string
  type?: string
  noIndex?: boolean
}

/**
 * Generate metadata for public pages
 */
export function generateSEOMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    image = `${BASE_URL}/og-image.png`,
    url = BASE_URL,
    type = 'website',
    noIndex = false
  } = config

  const fullTitle = title.includes(COMPANY_NAME) ? title : `${title} | ${COMPANY_NAME}`

  return {
    title: fullTitle,
    description,
    keywords: keywords.join(', '),
    authors: [{ name: COMPANY_NAME }],
    
    // Open Graph
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: COMPANY_NAME,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title
        }
      ],
      locale: 'es_PY',
      type
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image]
    },

    // Robots
    robots: noIndex
      ? {
          index: false,
          follow: false
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1
          }
        },

    // Verification (agregar cuando tengas las cuentas)
    // verification: {
    //   google: 'tu-codigo-google',
    //   yandex: 'tu-codigo-yandex',
    // },

    // Other
    alternates: {
      canonical: url
    }
  }
}

/**
 * Generate JSON-LD Schema for Organization
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: COMPANY_NAME,
    description: 'Reparación profesional de celulares y venta de accesorios',
    url: BASE_URL,
    telephone: '+595123456789',
    email: 'info@4gcelulares.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Av. Principal 123',
      addressLocality: 'Asunción',
      addressCountry: 'PY'
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: -25.2637,
      longitude: -57.5759
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '18:00'
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '09:00',
        closes: '13:00'
      }
    ],
    sameAs: [
      'https://facebook.com/4gcelulares',
      'https://instagram.com/4gcelulares'
    ]
  }
}

/**
 * Generate JSON-LD Schema for Product
 */
export function generateProductSchema(product: {
  id: string
  name: string
  description: string | null
  image: string | null
  price: number
  sku: string
  inStock: boolean
  brand: string | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || `${product.name} - ${COMPANY_NAME}`,
    image: product.image || `${BASE_URL}/placeholder-product.png`,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: product.brand || COMPANY_NAME
    },
    offers: {
      '@type': 'Offer',
      url: `${BASE_URL}/productos/${product.id}`,
      priceCurrency: 'PYG',
      price: product.price,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: COMPANY_NAME
      }
    }
  }
}

/**
 * Generate JSON-LD Schema for Breadcrumbs
 */
export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.url}`
    }))
  }
}
