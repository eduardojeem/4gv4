'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  Package,
  Loader2,
  MessageCircle,
  Mail,
  Phone,
  Share2,
  Check,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Breadcrumbs } from '@/components/public/Breadcrumbs'
import { ProductCard } from '@/components/public/ProductCard'
import { PublicProduct } from '@/types/public'
import { toast } from 'sonner'
import { generateProductSchema } from '@/lib/seo'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { formatPrice } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { useAuth } from '@/contexts/auth-context'
import useSWR from 'swr'

const productFetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) return null
  const body = await res.json()
  return body.success ? (body.data as PublicProduct) : null
}

const relatedFetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) return []
  const body = await res.json()
  return body.success ? (body.data.products as PublicProduct[]) : []
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { user } = useAuth()
  const [selectedImage, setSelectedImage] = useState(0)
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({})
  const { id } = React.use(params)
  const productId = decodeURIComponent(id).trim()
  const { settings } = useWebsiteSettings()

  const companyInfo = settings?.company_info
  const envSupportPhone = (
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ||
    process.env.NEXT_PUBLIC_COMPANY_PHONE ||
    ''
  ).toString()
  const envSupportEmail = (
    process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'info@4gcelulares.com'
  ).toString()
  const phoneDisplay = companyInfo?.phone || envSupportPhone
  const phoneClean = phoneDisplay?.replace(/\D/g, '')
  const emailDisplay = companyInfo?.email || envSupportEmail

  const isWholesale =
    user?.user_metadata?.customer_type === 'mayorista' ||
    user?.user_metadata?.customer_type === 'client_mayorista'

  // SWR for product data instead of useEffect+fetch
  const { data: product, isLoading } = useSWR(
    `/api/public/products/${productId}`,
    productFetcher,
    { revalidateOnFocus: false }
  )

  // SWR for related products
  const { data: allRelated } = useSWR(
    product?.category?.id
      ? `/api/public/products?category_id=${product.category.id}&per_page=4`
      : null,
    relatedFetcher,
    { revalidateOnFocus: false }
  )

  const relatedProducts = (allRelated ?? [])
    .filter((p) => p.id !== product?.id)
    .slice(0, 3)

  const handleContact = (method: 'whatsapp' | 'email' | 'phone') => {
    const message = `Hola, me interesa el producto: ${product?.name} (SKU: ${product?.sku})`

    switch (method) {
      case 'whatsapp':
        if (phoneClean) {
          window.open(
            `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`,
            '_blank'
          )
        } else if (emailDisplay) {
          window.location.href = `mailto:${emailDisplay}?subject=Consulta producto ${product?.sku}&body=${encodeURIComponent(message)}`
        }
        break
      case 'email':
        window.location.href = `mailto:${emailDisplay}?subject=Consulta producto ${product?.sku}&body=${encodeURIComponent(message)}`
        break
      case 'phone':
        if (phoneClean) {
          window.location.href = `tel:${phoneClean}`
        }
        break
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          text: `Mira este producto: ${product?.name}`,
          url: window.location.href,
        })
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Enlace copiado al portapapeles')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
          <Button
            variant="outline"
            className="mt-4 rounded-lg"
            onClick={() => router.push('/productos')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al catalogo
          </Button>
        </div>
      </div>
    )
  }

  const isInStock = product.stock_quantity > 0
  const displayPrice =
    isWholesale && product.wholesale_price
      ? product.wholesale_price
      : product.sale_price
  const hasDiscount =
    isWholesale &&
    product.wholesale_price != null &&
    product.wholesale_price < product.sale_price
  const discountPercent = hasDiscount
    ? Math.round(
        ((product.sale_price - product.wholesale_price!) / product.sale_price) *
          100
      )
    : 0

  const images =
    product.images && product.images.length > 0
      ? product.images.map((img) => resolveProductImageUrl(img))
      : [resolveProductImageUrl(product.image)]

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
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Volver al catalogo
          </Link>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Images */}
            <div className="space-y-3">
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                {images.length > 0 && !imageErrors[selectedImage] ? (
                  <Image
                    src={images[selectedImage]!}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority
                    onError={() => setImageErrors(prev => ({ ...prev, [selectedImage]: true }))}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted/20">
                    <Package className="h-24 w-24 text-muted-foreground/20" />
                  </div>
                )}

                {/* Share button */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-3 top-3 h-9 w-9 rounded-full shadow-md bg-background/80 backdrop-blur-sm border-0"
                  onClick={handleShare}
                  aria-label="Compartir producto"
                >
                  <Share2 className="h-4 w-4" />
                </Button>

                {/* Badges */}
                <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                  {product.featured && (
                    <Badge className="bg-foreground text-background border-0 text-xs shadow-sm">
                      Destacado
                    </Badge>
                  )}
                  {hasDiscount && (
                    <Badge className="bg-primary text-primary-foreground border-0 text-xs shadow-sm">
                      -{discountPercent}% OFF
                    </Badge>
                  )}
                </div>
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                        selectedImage === i
                          ? 'border-primary ring-1 ring-primary/20'
                          : 'border-transparent hover:border-border'
                      }`}
                    >
                      {!imageErrors[i] ? (
                        <Image
                          src={img}
                          alt={`${product.name} ${i + 1}`}
                          fill
                          className="object-cover"
                          sizes="80px"
                          onError={() => setImageErrors(prev => ({ ...prev, [i]: true }))}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted/20">
                          <Package className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                  Precio por {product.unit_measure} &middot; SKU:{' '}
                  <span className="font-mono">{product.sku}</span>
                </p>
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
                  {product.barcode && (
                    <div>
                      <dt className="text-muted-foreground">Codigo de barras</dt>
                      <dd className="font-mono font-medium text-foreground">
                        {product.barcode}
                      </dd>
                    </div>
                  )}
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

              {/* Contact CTA */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <h3 className="font-semibold text-foreground">
                  Te interesa este producto?
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contactanos para disponibilidad, pedidos o consultas.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    size="lg"
                    className="w-full gap-2 rounded-xl"
                    onClick={() => handleContact('whatsapp')}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Consultar por WhatsApp
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="gap-2 rounded-xl"
                      onClick={() => handleContact('email')}
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 rounded-xl"
                      onClick={() => handleContact('phone')}
                    >
                      <Phone className="h-4 w-4" />
                      Llamar
                    </Button>
                  </div>
                </div>
              </div>
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
                  <ProductCard key={rp.id} product={rp} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
