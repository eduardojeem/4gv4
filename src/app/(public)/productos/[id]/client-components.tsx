'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, Mail, Phone, Share2, Package, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { resolveProductImageUrl } from '@/lib/images'
import { PublicProduct } from '@/types/public'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { usePathname } from 'next/navigation'
import { usePublicCart } from '@/hooks/use-public-cart'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import { getWhatsAppLink } from '@/lib/whatsapp'

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
      try {
        await navigator.clipboard.writeText(window.location.href)
        toast.success('Enlace copiado al portapapeles')
      } catch {
        toast.error('No se pudo copiar el enlace automaticamente')
      }
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
            className="object-contain p-4"
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
              type="button"
              onClick={() => setSelectedImage(i)}
              aria-label={`Ver imagen ${i + 1} de ${images.length}`}
              aria-pressed={selectedImage === i}
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
  isInStock: boolean
}

export function ProductActions({ product, isInStock: initialIsInStock }: ProductActionsProps) {
  const { settings, isLoading: isLoadingWebsiteSettings } = useWebsiteSettings()
  const pathname = usePathname()
  const { addProduct } = usePublicCart()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''

  const hasVariants = Boolean(
    product.has_variants &&
    Array.isArray(product.variants) &&
    product.variants.length > 0
  )

  const attributeConfigs = product.variant_attribute_config || []
  const variants = product.variants || []

  // Pre-seleccionar la primera variante disponible con stock, o la primera activa
  const defaultVariant = useMemo(() => {
    if (!hasVariants || variants.length === 0) return null
    return variants.find((v) => v.stock_quantity > 0) || variants[0] || null
  }, [hasVariants, variants])

  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>(() => {
    if (defaultVariant?.attributes) {
      return { ...defaultVariant.attributes }
    }
    const initial: Record<string, string> = {}
    attributeConfigs.forEach((attr) => {
      if (attr.options.length > 0) {
        initial[attr.key] = attr.options[0]
      }
    })
    return initial
  })

  // Variante actualmente seleccionada
  const selectedVariant = useMemo(() => {
    if (!hasVariants || variants.length === 0) return null
    return variants.find((v) => {
      return Object.entries(selectedAttributes).every(
        ([key, val]) => v.attributes[key] === val
      )
    }) || null
  }, [hasVariants, variants, selectedAttributes])

  const handleSelectOption = (attrKey: string, optionValue: string) => {
    setSelectedAttributes((prev) => ({
      ...prev,
      [attrKey]: optionValue,
    }))
  }

  // Estado de stock y precio según la variante seleccionada
  const isInStock = hasVariants
    ? Boolean(selectedVariant && selectedVariant.stock_quantity > 0)
    : initialIsInStock

  const currentStockQuantity = hasVariants
    ? (selectedVariant?.stock_quantity ?? 0)
    : (product.stock_quantity ?? 0)

  const currentSku = hasVariants && selectedVariant?.sku
    ? selectedVariant.sku
    : product.sku

  const displayPrice = hasVariants && selectedVariant
    ? (product.has_offer && product.offer_price && product.offer_price < selectedVariant.sale_price
        ? product.offer_price
        : selectedVariant.sale_price)
    : Number(product.offer_price || product.sale_price || 0)

  const companyInfo = settings?.company_info
  const envSupportPhone = (
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ||
    process.env.NEXT_PUBLIC_COMPANY_PHONE ||
    ''
  ).toString()
  const envSupportEmail = (
    process.env.NEXT_PUBLIC_COMPANY_EMAIL || ''
  ).toString()
  const commerceMode = settings?.checkout.commerceMode ?? 'cart'
  const phoneDisplay = companyInfo?.whatsapp || companyInfo?.phone || envSupportPhone
  const phoneClean = phoneDisplay?.replace(/\D/g, '')
  const emailDisplay = companyInfo?.email || envSupportEmail

  const handleAddToCart = () => {
    if (commerceMode !== 'cart') return
    if (!isInStock) {
      toast.error('Esta combinación no tiene stock disponible')
      return
    }

    const result = addProduct(product, displayPrice, 1, selectedVariant)
    if (result.limited) {
      toast.info(`Ya agregaste el máximo disponible (${result.quantity}).`)
      return
    }
    toast.success(
      selectedVariant
        ? `"${product.name} (${selectedVariant.variant_name})" agregado al carrito`
        : 'Producto agregado al carrito'
    )
  }

  const handleContact = (method: 'whatsapp' | 'email' | 'phone') => {
    const variantSuffix = selectedVariant ? ` · Variante: ${selectedVariant.variant_name}` : ''
    const message = `Hola, me interesa el producto: ${product.name}${variantSuffix} (SKU: ${currentSku})`

    switch (method) {
      case 'whatsapp':
        if (phoneClean) {
          window.open(
            getWhatsAppLink({ phone: phoneDisplay, message }),
            '_blank',
            'noopener,noreferrer'
          )
        } else if (emailDisplay) {
          window.location.href = `mailto:${emailDisplay}?subject=Consulta producto ${currentSku}&body=${encodeURIComponent(
            message
          )}`
        } else {
          toast.error('No hay un canal de contacto configurado')
        }
        break
      case 'email':
        if (emailDisplay) {
          window.location.href = `mailto:${emailDisplay}?subject=Consulta producto ${currentSku}&body=${encodeURIComponent(
            message
          )}`
        } else {
          toast.error('No hay correo de contacto configurado')
        }
        break
      case 'phone':
        if (phoneClean) {
          window.location.href = `tel:${phoneClean}`
        } else {
          toast.error('No hay telefono de contacto configurado')
        }
        break
    }
  }

  if (isLoadingWebsiteSettings || commerceMode === 'catalog') {
    return null
  }

  return (
    <div className="space-y-4">
      {/* ── SELECTOR DE VARIANTES INTERACTIVO ── */}
      {hasVariants && attributeConfigs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Opciones del Producto
            </h3>
            {selectedVariant && (
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                SKU: {currentSku}
              </span>
            )}
          </div>

          <div className="space-y-3.5">
            {attributeConfigs.map((attr) => {
              const selectedValue = selectedAttributes[attr.key]
              return (
                <div key={attr.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {attr.label}:
                    </span>
                    {selectedValue && (
                      <span className="font-medium text-primary">
                        {selectedValue}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {attr.options.map((option) => {
                      const isSelected = selectedValue === option

                      // Verificar si existe una combinación válida con stock para esta opción
                      const matchingVar = variants.find((v) => {
                        const testAttrs = { ...selectedAttributes, [attr.key]: option }
                        return Object.entries(testAttrs).every(([k, val]) => v.attributes[k] === val)
                      })
                      const optionHasStock = matchingVar ? matchingVar.stock_quantity > 0 : true

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleSelectOption(attr.key, option)}
                          className={`relative inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all select-none ${
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20 scale-[1.02]'
                              : optionHasStock
                              ? 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                              : 'border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 line-through opacity-70'
                          }`}
                        >
                          {isSelected && <span className="text-[10px]">✓</span>}
                          {option}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Resumen de la variante activa */}
          {selectedVariant ? (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5 text-xs border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedVariant.variant_name}
                </span>
              </div>
              <div>
                {isInStock ? (
                  <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium text-[11px]">
                    ✓ {currentStockQuantity} en stock
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[11px]">
                    ✕ Sin stock
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Seleccioná una combinación de opciones para continuar.
            </p>
          )}
        </div>
      )}

      {/* ── CARD DE ACCIONES DE COMPRA / CONTACTO ── */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="font-semibold text-foreground">
          {isInStock ? '¿Te interesa este producto?' : 'Combinación temporalmente agotada'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isInStock
            ? 'Contactanos para disponibilidad, pedidos o consultas.'
            : 'Contactanos para consultar reposición o alternativas disponibles.'}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {commerceMode === 'cart' && (
            <Button
              size="lg"
              className="w-full gap-2 rounded-xl"
              onClick={handleAddToCart}
              disabled={!isInStock}
            >
              <ShoppingCart className="h-4 w-4" />
              {isInStock ? 'Agregar al carrito' : 'Combinación sin stock'}
            </Button>
          )}

          <Button
            size="lg"
            variant={commerceMode === 'whatsapp' ? 'default' : 'outline'}
            className={cn(
              'w-full gap-2 rounded-xl',
              commerceMode === 'whatsapp' && 'bg-emerald-600 text-white hover:bg-emerald-700'
            )}
            onClick={() => handleContact('whatsapp')}
          >
            <MessageCircle className="h-4 w-4" />
            {isInStock ? 'Consultar por WhatsApp' : 'Consultar reposición por WhatsApp'}
          </Button>

          {commerceMode === 'cart' && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={() => handleContact('email')}
                disabled={!emailDisplay}
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={() => handleContact('phone')}
                disabled={!phoneClean}
              >
                <Phone className="h-4 w-4" />
                Llamar
              </Button>
            </div>
          )}

          {!isInStock && (
            <Button asChild variant="secondary" className="w-full rounded-xl">
              <Link href={product.category ? `${tenantPrefix}/productos?category_id=${product.category.id}` : `${tenantPrefix}/productos`}>
                Ver productos similares
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
