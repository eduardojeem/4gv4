'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, Mail, Phone, Share2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { resolveProductImageUrl } from '@/lib/images'
import { PublicProduct } from '@/types/public'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'

interface ProductGalleryProps {
  product: PublicProduct
  hasDiscount: boolean
  discountPercent: number
}

export function ProductGallery({ product, hasDiscount, discountPercent }: ProductGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(0)
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({})

  const mainImage = resolveProductImageUrl(product.image)
  
  // Ensure main image is first and avoid duplicates
  const otherImages = (product.images || [])
    .map(img => resolveProductImageUrl(img))
    .filter(img => img !== mainImage)
    
  const images = [mainImage, ...otherImages].filter(Boolean) as string[]

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Mira este producto: ${product.name}`,
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

  return (
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
            onError={() => setImageErrors((prev) => ({ ...prev, [selectedImage]: true }))}
            unoptimized={
              images[selectedImage]!.startsWith('data:') ||
              images[selectedImage]! === '/placeholder-product.svg'
            }
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
                  onError={() => setImageErrors((prev) => ({ ...prev, [i]: true }))}
                  unoptimized={
                    img.startsWith('data:') || img === '/placeholder-product.svg'
                  }
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
  )
}

interface ProductActionsProps {
  product: PublicProduct
}

export function ProductActions({ product }: ProductActionsProps) {
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

  const handleContact = (method: 'whatsapp' | 'email' | 'phone') => {
    const message = `Hola, me interesa el producto: ${product.name} (SKU: ${product.sku})`

    switch (method) {
      case 'whatsapp':
        if (phoneClean) {
          window.open(
            `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`,
            '_blank'
          )
        } else if (emailDisplay) {
          window.location.href = `mailto:${emailDisplay}?subject=Consulta producto ${product.sku}&body=${encodeURIComponent(
            message
          )}`
        }
        break
      case 'email':
        window.location.href = `mailto:${emailDisplay}?subject=Consulta producto ${product.sku}&body=${encodeURIComponent(
          message
        )}`
        break
      case 'phone':
        if (phoneClean) {
          window.location.href = `tel:${phoneClean}`
        }
        break
    }
  }

  return (
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
  )
}
