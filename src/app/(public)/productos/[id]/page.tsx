'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Package, Loader2, MessageCircle, Mail, Phone, Share2, Heart, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Breadcrumbs } from '@/components/public/Breadcrumbs'
import { ProductCard } from '@/components/public/ProductCard'
import { PublicProduct } from '@/types/public'
import { toast } from 'sonner'
import { generateProductSchema } from '@/lib/seo'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { formatPrice, cleanImageUrl } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { user } = useAuth()
  const [product, setProduct] = useState<PublicProduct | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<PublicProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const { id } = React.use(params)
  const productId = decodeURIComponent(id).trim()
  const { settings } = useWebsiteSettings()
  
  const companyInfo = settings?.company_info
  const envSupportPhone = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || process.env.NEXT_PUBLIC_COMPANY_PHONE || '').toString()
  const envSupportEmail = (process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'info@4gcelulares.com').toString()
  const phoneDisplay = companyInfo?.phone || envSupportPhone
  const phoneClean = phoneDisplay?.replace(/\D/g, '')
  const emailDisplay = companyInfo?.email || envSupportEmail

  // Determinar si el usuario es mayorista basado en metadata
  const isWholesale = user?.user_metadata?.customer_type === 'mayorista' || 
                      user?.user_metadata?.customer_type === 'client_mayorista'

  const fetchProduct = useCallback(async () => {
    try {
      const response = await fetch(`/api/public/products/${productId}`)
      const data = await response.json()

      if (!data.success) {
        toast.error('Producto no encontrado')
        router.push('/productos')
        return
      }

      setProduct(data.data)

      // Fetch related products
      if (data.data.category?.id) {
        const relatedRes = await fetch(
          `/api/public/products?category_id=${data.data.category.id}&per_page=4`
        )
        const relatedData = await relatedRes.json()
        if (relatedData.success) {
          // Filtrar el producto actual
          const filtered = relatedData.data.products.filter(
            (p: PublicProduct) => p.id !== data.data.id
          )
          setRelatedProducts(filtered.slice(0, 3))
        }
      }

      // Update page title dynamically
      if (data.data.name) {
        document.title = `${data.data.name} | 4G Celulares`
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      toast.error('Error al cargar el producto')
    } finally {
      setLoading(false)
    }
  }, [productId, router])

  useEffect(() => {
    fetchProduct()
  }, [fetchProduct])

  const handleContact = (method: 'whatsapp' | 'email' | 'phone') => {
    const message = `Hola, me interesa el producto: ${product?.name} (SKU: ${product?.sku})`
    
    switch (method) {
      case 'whatsapp':
        if (phoneClean) {
          window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`, '_blank')
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
          url: window.location.href
        })
      } catch (error) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
      toast.success('Enlace copiado al portapapeles')
    }
  }

  if (loading) {
    return (
      <div className="container flex min-h-[calc(100vh-200px)] items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container py-12 text-center">
        <p className="text-muted-foreground">Producto no encontrado</p>
      </div>
    )
  }

  const isInStock = product.stock_quantity > 0
  const displayPrice = isWholesale && product.wholesale_price 
    ? product.wholesale_price 
    : product.sale_price
  const hasDiscount = isWholesale && product.wholesale_price && product.wholesale_price < product.sale_price
  const discountPercent = hasDiscount 
    ? Math.round(((product.sale_price - product.wholesale_price!) / product.sale_price) * 100)
    : 0

  const images = product.images && product.images.length > 0 
    ? product.images.map(cleanImageUrl).filter((img): img is string => !!img)
    : [cleanImageUrl(product.image)].filter((img): img is string => !!img)

  // Generate product schema
  const productSchema = generateProductSchema({
    id: product.id,
    name: product.name,
    description: product.description,
    image: product.image,
    price: product.sale_price,
    sku: product.sku,
    inStock: isInStock,
    brand: product.brand
  })

  return (
    <>
      {/* Schema.org JSON-LD for Product */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      <div className="container py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs 
          items={[
            { label: 'Productos', href: '/productos' },
            ...(product.category ? [{ label: product.category.name, href: `/productos?category_id=${product.category.id}` }] : []),
            { label: product.name }
          ]} 
        />

        {/* Back Button */}
        <Button variant="ghost" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al catálogo
        </Button>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image Section */}
          <div>
            <div className="sticky top-8 space-y-4">
              {/* Main Image */}
              <div className="relative aspect-square overflow-hidden rounded-xl border bg-gradient-to-br from-muted to-muted/50 shadow-lg">
                {images.length > 0 ? (
                  <Image
                    src={images[selectedImage]}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-32 w-32 text-muted-foreground/40" />
                  </div>
                )}

                {/* Badges on Image */}
                <div className="absolute left-4 top-4 flex flex-col gap-2">
                  {product.featured && (
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 border-0 shadow-lg">
                      ⭐ Destacado
                    </Badge>
                  )}
                  {hasDiscount && (
                    <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 border-0 shadow-lg">
                      -{discountPercent}% OFF
                    </Badge>
                  )}
                </div>

                {/* Share Button */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-4 shadow-lg"
                  onClick={handleShare}
                  aria-label="Compartir producto"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Image Gallery */}
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                        selectedImage === i 
                          ? 'border-primary ring-2 ring-primary/20' 
                          : 'border-transparent hover:border-muted-foreground/20'
                      }`}
                    >
                      <Image 
                        src={img} 
                        alt={`${product.name} ${i + 1}`} 
                        fill 
                        className="object-cover" 
                        sizes="100px"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              {product.brand && (
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {product.brand}
                </p>
              )}
              <h1 className="mt-2 text-4xl font-bold tracking-tight">{product.name}</h1>
              
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge 
                  variant={isInStock ? 'default' : 'destructive'}
                  className="text-sm px-3 py-1"
                >
                  {isInStock ? `✓ ${product.stock_quantity} en stock` : '✗ Agotado'}
                </Badge>
                {product.category && (
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {product.category.name}
                  </Badge>
                )}
                {isWholesale && product.wholesale_price && (
                  <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-sm px-3 py-1">
                    💼 Precio Mayorista
                  </Badge>
                )}
              </div>
            </div>

            {/* Price */}
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-baseline gap-3">
                  <p className="text-5xl font-bold text-primary">
                    {formatPrice(displayPrice)}
                  </p>
                  {hasDiscount && (
                    <p className="text-xl text-muted-foreground line-through">
                      {formatPrice(product.sale_price)}
                    </p>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Precio por {product.unit_measure} • SKU: <span className="font-mono">{product.sku}</span>
                </p>
              </CardContent>
            </Card>

            {/* CTA Buttons */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-lg">¿Te interesa este producto?</h3>
                <p className="text-sm text-muted-foreground">
                  Contáctanos para consultar disponibilidad, realizar tu pedido o resolver dudas
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    size="lg"
                    className="w-full gap-2 text-base"
                    onClick={() => handleContact('whatsapp')}
                  >
                    <MessageCircle className="h-5 w-5" />
                    Consultar por WhatsApp
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleContact('email')}
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleContact('phone')}
                    >
                      <Phone className="h-4 w-4" />
                      Llamar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Details Tabs */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="description">Descripción</TabsTrigger>
                <TabsTrigger value="details">Detalles</TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    {product.description ? (
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                        {product.description}
                      </p>
                    ) : (
                      <p className="text-muted-foreground italic">
                        No hay descripción disponible para este producto.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="details" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    <dl className="grid gap-4">
                      <div className="flex justify-between py-2 border-b">
                        <dt className="font-medium text-muted-foreground">SKU</dt>
                        <dd className="font-mono font-semibold">{product.sku}</dd>
                      </div>
                      {product.barcode && (
                        <div className="flex justify-between py-2 border-b">
                          <dt className="font-medium text-muted-foreground">Código de barras</dt>
                          <dd className="font-mono font-semibold">{product.barcode}</dd>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b">
                        <dt className="font-medium text-muted-foreground">Unidad de medida</dt>
                        <dd className="font-semibold">{product.unit_measure}</dd>
                      </div>
                      {product.brand && (
                        <div className="flex justify-between py-2 border-b">
                          <dt className="font-medium text-muted-foreground">Marca</dt>
                          <dd className="font-semibold">{product.brand}</dd>
                        </div>
                      )}
                      {product.category && (
                        <div className="flex justify-between py-2 border-b">
                          <dt className="font-medium text-muted-foreground">Categoría</dt>
                          <dd className="font-semibold">{product.category.name}</dd>
                        </div>
                      )}
                      <div className="flex justify-between py-2">
                        <dt className="font-medium text-muted-foreground">Disponibilidad</dt>
                        <dd className="font-semibold">
                          {isInStock ? (
                            <span className="text-green-600">{product.stock_quantity} unidades</span>
                          ) : (
                            <span className="text-red-600">Agotado</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <div className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight">Productos relacionados</h2>
              <p className="mt-2 text-muted-foreground">
                Otros productos que podrían interesarte
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
