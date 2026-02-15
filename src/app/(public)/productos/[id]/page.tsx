'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Package, Loader2, Mail, Phone, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PublicProduct } from '@/types/public'
import { toast } from 'sonner'
import { generateProductSchema } from '@/lib/seo'
import Head from 'next/head'

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [product, setProduct] = useState<PublicProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const { id } = React.use(params)
  const productId = decodeURIComponent(id).trim()

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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0
    }).format(price)
  }

  const handleContact = (method: 'whatsapp' | 'email' | 'phone') => {
    const message = `Hola, me interesa el producto: ${product?.name} (SKU: ${product?.sku})`
    
    switch (method) {
      case 'whatsapp':
        window.open(`https://wa.me/595123456789?text=${encodeURIComponent(message)}`, '_blank')
        break
      case 'email':
        window.location.href = `mailto:info@4gcelulares.com?subject=Consulta producto ${product?.sku}&body=${encodeURIComponent(message)}`
        break
      case 'phone':
        window.location.href = 'tel:+595123456789'
        break
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
  const imageSrc = typeof product.image === 'string' 
    ? product.image.replace(/\)+$/, '').trim()
    : null

  // Generate product schema
  const productSchema = product ? generateProductSchema({
    id: product.id,
    name: product.name,
    description: product.description,
    image: product.image,
    price: product.sale_price,
    sku: product.sku,
    inStock: isInStock,
    brand: product.brand
  }) : null

  return (
    <>
      {/* Schema.org JSON-LD for Product */}
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}

      <div className="container py-8">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al catálogo
      </Button>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Image Section */}
        <div>
          <div className="sticky top-8">
            <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {imageSrc ? (
                <Image
                  src={imageSrc}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Image Gallery (if multiple images) */}
            {product.images && product.images.length > 1 && (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {product.images.slice(0, 4).map((img, i) => (
                  <div
                    key={i}
                    className="relative aspect-square overflow-hidden rounded border bg-muted"
                  >
                    <Image src={img} alt={`${product.name} ${i + 1}`} fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Title and Badges */}
          <div>
            {product.brand && (
              <p className="text-sm text-muted-foreground">{product.brand}</p>
            )}
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{product.name}</h1>
            
            <div className="mt-4 flex flex-wrap gap-2">
              {product.featured && (
                <Badge variant="default">Destacado</Badge>
              )}
              <Badge variant={isInStock ? 'secondary' : 'destructive'}>
                {isInStock ? `${product.stock_quantity} en stock` : 'Agotado'}
              </Badge>
              {product.category && (
                <Badge variant="outline">{product.category.name}</Badge>
              )}
            </div>
          </div>

          {/* Price */}
          <div>
            <p className="text-4xl font-bold text-primary">
              {formatPrice(product.sale_price)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Precio por {product.unit_measure}
            </p>
          </div>

          {/* Description */}
          {product.description && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold">Descripción</h3>
                <p className="mt-2 text-muted-foreground">{product.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h3 className="font-semibold">Detalles</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SKU:</span>
                  <span className="font-medium">{product.sku}</span>
                </div>
                {product.barcode && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Código de barras:</span>
                    <span className="font-medium">{product.barcode}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unidad:</span>
                  <span className="font-medium">{product.unit_measure}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Options */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <h3 className="font-semibold">Consultar disponibilidad</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Contáctanos para más información o para realizar tu pedido
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  className="w-full gap-2"
                  onClick={() => handleContact('whatsapp')}
                >
                  <MessageCircle className="h-4 w-4" />
                  Consultar por WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleContact('email')}
                >
                  <Mail className="h-4 w-4" />
                  Consultar por Email
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleContact('phone')}
                >
                  <Phone className="h-4 w-4" />
                  Llamar al local
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </>
  )
}
