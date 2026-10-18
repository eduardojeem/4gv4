import { NextResponse } from 'next/server'
import {
  getMarketplaceBrands,
  getMarketplaceCategories,
  getMarketplaceOffers,
  getMarketplaceOrganizationCount,
  getMarketplaceOrganizations,
  getMarketplaceProductsPage,
  type MarketplaceProduct,
} from '@/lib/public/marketplace'
import { visibleDirectoryStats } from '@/lib/public/business-directory'
import { getSiteUrl } from '@/lib/site-url'
import { logger } from '@/lib/logger'
import { normalizeCity } from '@/lib/public/city-normalizer'

/**
 * Portada del marketplace para la app móvil: lo mismo que arma /marketplace en
 * la web (mismas funciones, misma caché), en un solo pedido y con solo los
 * campos que dibuja la app. Es público como la web.
 */

export const revalidate = 60

const absolute = (url?: string | null) => {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  return `${getSiteUrl().replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

const toProduct = (product: MarketplaceProduct) => ({
  id: product.id,
  name: product.name,
  brand: product.brand,
  category: product.category ? { id: product.category.id, name: product.category.name } : null,
  image: absolute(product.image ?? product.images?.[0]),
  price: product.hide_price ? null : product.sale_price,
  offerPrice:
    !product.hide_price && product.has_offer && product.offer_price && product.offer_price < product.sale_price
      ? product.offer_price
      : null,
  inStock: product.in_stock,
  featured: product.featured,
  store: { name: product.organization_name, slug: product.organization_slug },
})

export async function GET() {
  try {
    const [organizations, organizationCount, firstProductsPage, brands, initialOffers, categories] =
      await Promise.all([
        getMarketplaceOrganizations().catch(() => []),
        getMarketplaceOrganizationCount().catch(() => 0),
        getMarketplaceProductsPage(100).catch(() => ({ products: [], total: 0 })),
        getMarketplaceBrands(60).catch(() => []),
        getMarketplaceOffers(100).catch(() => []),
        getMarketplaceCategories().catch(() => []),
      ])

    // Si el catálogo total tiene más de 100 productos, traemos los lotes restantes en paralelo
    const totalCatalogProducts = firstProductsPage.total
    const remainingOffsets: number[] = []
    for (let offset = 100; offset < Math.min(totalCatalogProducts, 1000); offset += 100) {
      remainingOffsets.push(offset)
    }

    const remainingPages =
      remainingOffsets.length > 0
        ? await Promise.all(
            remainingOffsets.map((offset) =>
              getMarketplaceProductsPage(100, { offset }).catch(() => ({
                products: [] as MarketplaceProduct[],
                total: totalCatalogProducts,
              }))
            )
          )
        : []

    const allCatalogProducts = [
      ...firstProductsPage.products,
      ...remainingPages.flatMap((page) => page.products),
    ]

    // Mismo orden que la web: destacados primero.
    const products = [...allCatalogProducts].sort((a, b) => Number(b.featured) - Number(a.featured))

    // Consolidamos ofertas de initialOffers y cualquier producto con oferta de allCatalogProducts
    const offersMap = new Map<string, MarketplaceProduct>()
    for (const off of initialOffers) {
      offersMap.set(off.id, off)
    }
    for (const prod of allCatalogProducts) {
      if (prod.has_offer && prod.offer_price && prod.offer_price < prod.sale_price && !prod.hide_price) {
        if (!offersMap.has(prod.id)) {
          offersMap.set(prod.id, prod)
        }
      }
    }

    const offerProducts = Array.from(offersMap.values())
      .filter(
        (product) =>
          product.has_offer &&
          product.offer_price &&
          product.offer_price < product.sale_price &&
          !product.hide_price
      )
      .sort((a, b) => Number(b.featured) - Number(a.featured))

    const storeCount = Math.max(organizations.length, organizationCount)
    const stats = visibleDirectoryStats({ stores: storeCount, cities: 0, products: totalCatalogProducts })

    return NextResponse.json({
      stats: stats.map((stat) => ({ key: stat.key, value: stat.value })),
      categories: categories
        .filter((category) => !category.parent_id && category.product_count > 0)
        .sort((a, b) => b.product_count - a.product_count)
        .slice(0, 30)
        .map((category) => ({ id: category.id, name: category.name, count: category.product_count })),
      offers: offerProducts.map(toProduct),
      brands: brands.map((brand) => ({ name: brand.name, logo: absolute(brand.logo_url), count: brand.product_count })),
      products: products.map(toProduct),
      stores: organizations.map((organization) => {
        // La misma unificación que /empresas: «asuncion», «Asunción, Paraguay» y
        // «ASU» son una sola ciudad, con el nombre bien escrito.
        const city = normalizeCity(organization.city)
        return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: absolute(organization.logo_url),
        city: city?.display ?? null,
        cityKey: city?.key ?? null,
        rubro: organization.rubro ?? null,
        whatsapp: organization.whatsapp ?? organization.phone ?? null,
        products: organization.products_count,
        rating: organization.review_rating_avg ?? null,
        }
      }),
    })
  } catch (error) {
    logger.error('[mobile-marketplace] No se pudo armar la portada', error)
    return NextResponse.json({ error: 'No pudimos cargar el marketplace.' }, { status: 500 })
  }
}
