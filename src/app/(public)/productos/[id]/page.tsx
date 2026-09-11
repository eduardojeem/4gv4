
import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Check, XCircle, Package, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/public/Breadcrumbs'
import { ProductCard } from '@/components/public/ProductCard'
import { getPublicProduct, getPublicProducts, resolveWholesaleStatus, getProductBranchStock } from '@/lib/api/products-server'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { generateProductSchema, serializeJsonLd } from '@/lib/seo'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import { ProductDetailInteractive } from './client-components'
import { BranchAvailability } from '@/components/public/BranchAvailability'
import { getPublicTenantPathPrefix, prefixPublicTenantPath } from '@/lib/public/tenant-path'

// Allow ISR with 2-minute revalidation
// Same window as the list page — stock changes show within 60 s in both views
export const revalidate = 60

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata(
  props: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await props.params
  const tenantPrefix = await getPublicTenantPathPrefix()
  const result = await getPublicProduct(params.id)

  if (!result) {
    return {
      title: 'Producto no encontrado',
    }
  }

  const { product } = result
  const settings = await fetchWebsiteSettings()
  const companyName = settings?.company_info?.name || 'Tienda'
  const previousImages = (await parent).openGraph?.images || []
  const productImage = resolveProductImageUrl(product.image)

  return {
    title: `${product.name} | ${companyName}`,
    description: product.description?.slice(0, 160) || `Comprar ${product.name} en ${companyName}`,
    openGraph: {
      title: product.name,
      description: product.description?.slice(0, 160) || `Comprar ${product.name}`,
      images: [productImage, ...previousImages],
    },
  }
}

export default async function ProductDetailPage(props: Props) {
  const params = await props.params
  const tenantPrefix = await getPublicTenantPathPrefix()

  // Resolve wholesale status once — shared across all queries in this page
  const { isWholesale } = await resolveWholesaleStatus()

  const result = await getPublicProduct(params.id, isWholesale)

  if (!result) {
    return (
      <div className="container py-20 text-center">
        <div className="mx-auto max-w-md">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">Producto no encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Es posible que el producto haya sido removido o no este disponible.
          </p>
          <Button variant="outline" className="mt-4 rounded-lg" asChild>
            <Link href={prefixPublicTenantPath(tenantPrefix, '/productos')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al catalogo
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const { product } = result
  const productsHref = prefixPublicTenantPath(tenantPrefix, '/productos')

  // Prepare display data
  const isInStock = product.in_stock
  const hasOffer = !isWholesale && product.has_offer === true && product.offer_price != null && product.offer_price < product.sale_price
  const isWholesaleDiscount = isWholesale && product.wholesale_price != null && product.wholesale_price < product.sale_price
  const displayPrice = hasOffer
    ? product.offer_price!
    : isWholesale && product.wholesale_price
    ? product.wholesale_price
    : product.sale_price
  const hasDiscount = hasOffer || isWholesaleDiscount
  const discountPercent = hasDiscount
    ? Math.round(((product.sale_price - displayPrice) / product.sale_price) * 100)
    : 0

  // Cuotas / financiación — informativo para la tienda pública.
  // Se muestran solo si están activadas Y marcadas como visibles en la web.
  const installmentPlans =
    product.installments_enabled &&
    product.installments_public !== false &&
    Array.isArray(product.installments_plans)
      ? product.installments_plans
      : []

  // Fetch related products and branch stock in parallel
  const [relatedData, branchStock] = await Promise.all([
    product.category
      ? getPublicProducts({ categoryId: product.category.id, perPage: 4, isWholesale })
      : Promise.resolve({ products: [] as typeof result.product[] }),
    getProductBranchStock(product.id),
  ])

  const relatedProducts = (relatedData.products as typeof result.product[])
    .filter((p) => p.id !== product.id)
    .slice(0, 3)

  const productSchema = generateProductSchema({
    id: product.id,
    name: product.name,
    description: product.description,
    image: resolveProductImageUrl(product.image),
    price: product.sale_price,
    sku: product.sku,
    inStock: isInStock,
    brand: product.brand,
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productSchema) }}
      />

      <div className="min-h-screen bg-background">
        {/* Top bar */}
        <div className="border-b border-border/50 bg-muted/30">
          <div className="container py-4">
            <Breadcrumbs
              items={[
                { label: 'Productos', href: productsHref },
                ...(product.category
                  ? [
                      {
                        label: product.category.name,
                        href: prefixPublicTenantPath(tenantPrefix, `/productos?category_id=${product.category.id}`),
                      },
                    ]
                  : []),
                { label: product.name },
              ]}
            />
          </div>
        </div>

        <div className="container py-8 lg:py-12">
          {/* Back link */}
          <Link
            href={productsHref}
            className="mb-8 hidden items-center text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver al catalogo
          </Link>

          <ProductDetailInteractive
            product={product}
            isWholesale={isWholesale}
            hasDiscount={hasDiscount}
            discountPercent={discountPercent}
            installmentPlans={installmentPlans}
            branchStock={branchStock}
          />

          {/* Related */}
          {relatedProducts.length > 0 && (
            <section className="mt-16 lg:mt-20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Productos relacionados
                </h2>
                {product.category && (
                  <Link
                    href={prefixPublicTenantPath(tenantPrefix, `/productos?category_id=${product.category.id}`)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Ver mas
                  </Link>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {relatedProducts.map((rp) => (
                  <ProductCard key={rp.id} product={rp} isWholesale={isWholesale} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
