
import React from 'react'
import { Metadata, ResolvingMetadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Check, XCircle, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/public/Breadcrumbs'
import { ProductCard } from '@/components/public/ProductCard'
import { getPublicProduct, getPublicProducts } from '@/lib/api/products-server'
import { generateProductSchema } from '@/lib/seo'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import { ProductGallery, ProductActions } from './client-components'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata(
  props: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await props.params
  const product = await getPublicProduct(params.id)

  if (!product) {
    return {
      title: 'Producto no encontrado',
    }
  }

  const previousImages = (await parent).openGraph?.images || []
  const productImage = resolveProductImageUrl(product.image)

  return {
    title: `${product.name} | 4G Celulares`,
    description: product.description?.slice(0, 160) || `Comprar ${product.name} en 4G Celulares`,
    openGraph: {
      title: product.name,
      description: product.description?.slice(0, 160) || `Comprar ${product.name}`,
      images: [productImage, ...previousImages],
    },
  }
}

export default async function ProductDetailPage(props: Props) {
  const params = await props.params
  const product = await getPublicProduct(params.id)

  if (!product) {
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
            <Link href="/productos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al catalogo
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // Get wholesale status
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  let isWholesale = false
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
    const role = profile?.role || session.user.user_metadata?.role
    isWholesale = role === 'mayorista' || role === 'client_mayorista'
  }

  // Prepare display data
  const isInStock = product.stock_quantity > 0
  const displayPrice = isWholesale && product.wholesale_price
    ? product.wholesale_price
    : product.sale_price
  const hasDiscount = isWholesale &&
    product.wholesale_price != null &&
    product.wholesale_price < product.sale_price
  const discountPercent = hasDiscount
    ? Math.round(((product.sale_price - product.wholesale_price!) / product.sale_price) * 100)
    : 0

  // Fetch related products
  const relatedData = product.category 
    ? await getPublicProducts({ categoryId: product.category.id, perPage: 4 })
    : { products: [] }
  
  const relatedProducts = relatedData.products
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      <div className="min-h-screen bg-background">
        {/* Top bar */}
        <div className="border-b border-border/50 bg-muted/30">
          <div className="container py-4">
            <Breadcrumbs
              items={[
                { label: 'Productos', href: '/productos' },
                ...(product.category
                  ? [
                      {
                        label: product.category.name,
                        href: `/productos?category_id=${product.category.id}`,
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
            href="/productos"
            className="mb-8 hidden items-center text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver al catalogo
          </Link>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Images - Client Component */}
            <ProductGallery 
                product={product} 
                hasDiscount={hasDiscount} 
                discountPercent={discountPercent} 
            />

            {/* Product info */}
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div>
                {product.brand && (
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {product.brand}
                  </p>
                )}
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground lg:text-3xl text-balance">
                  {product.name}
                </h1>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge
                    variant={isInStock ? 'secondary' : 'destructive'}
                    className="gap-1.5 text-xs rounded-full"
                  >
                    {isInStock ? (
                      <>
                        <Check className="h-3 w-3" /> En stock
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" /> Agotado
                      </>
                    )}
                  </Badge>
                  {product.category && (
                    <Badge variant="outline" className="text-xs rounded-full">
                      {product.category.name}
                    </Badge>
                  )}
                  {isWholesale && product.wholesale_price && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs rounded-full">
                      Precio Mayorista
                    </Badge>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="rounded-2xl border border-border p-5">
                <div className="flex items-baseline gap-3">
                  <p className="text-4xl font-bold text-foreground">
                    {formatPrice(displayPrice)}
                  </p>
                  {hasDiscount && (
                    <p className="text-lg text-muted-foreground line-through">
                      {formatPrice(product.sale_price)}
                    </p>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Precio por {product.unit_measure}
                </p>
                {isInStock && (
                  <p className="mt-1 text-xs text-primary">
                    Stock disponible: {product.stock_quantity} {product.stock_quantity === 1 ? 'unidad' : 'unidades'}
                  </p>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Descripcion
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Details */}
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Detalles
                </h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">SKU</dt>
                    <dd className="font-mono font-medium text-foreground">
                      {product.sku}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Unidad</dt>
                    <dd className="font-medium text-foreground">
                      {product.unit_measure}
                    </dd>
                  </div>
                  {product.brand && (
                    <div>
                      <dt className="text-muted-foreground">Marca</dt>
                      <dd className="font-medium text-foreground">
                        {product.brand}
                      </dd>
                    </div>
                  )}
                  {product.category && (
                    <div>
                      <dt className="text-muted-foreground">Categoria</dt>
                      <dd className="font-medium text-foreground">
                        {product.category.name}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground">Disponibilidad</dt>
                    <dd className="font-medium">
                      {isInStock ? (
                        <span className="text-primary">En stock</span>
                      ) : (
                        <span className="text-destructive">Agotado</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Contact CTA - Client Component */}
              <ProductActions product={product} isInStock={isInStock} />
            </div>
          </div>

          {/* Related */}
          {relatedProducts.length > 0 && (
            <section className="mt-16 lg:mt-20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Productos relacionados
                </h2>
                {product.category && (
                  <Link
                    href={`/productos?category_id=${product.category.id}`}
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
