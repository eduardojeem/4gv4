'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MessageCircle,
  Mail,
  Phone,
  Share2,
  Package,
  ShoppingCart,
  Check,
  XCircle,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'
import { resolveProductImageUrl } from '@/lib/images'
import type { PublicProduct, PublicProductVariant, InstallmentPlanOption } from '@/types/public'
import type { BranchStockInfo } from '@/lib/api/products-server'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { usePathname } from 'next/navigation'
import { usePublicCart } from '@/hooks/use-public-cart'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn, formatPrice } from '@/lib/utils'
import { getWhatsAppLink } from '@/lib/whatsapp'
import { InstallmentSelector } from '@/components/public/InstallmentSelector'
import { BranchAvailability } from '@/components/public/BranchAvailability'

const COLOR_HEX_MAP: Record<string, string> = {
  blanco: '#ffffff',
  white: '#ffffff',
  negro: '#18181b',
  black: '#18181b',
  gris: '#9ca3af',
  grey: '#9ca3af',
  gray: '#9ca3af',
  beige: '#d4b996',
  'azul marino': '#0f172a',
  marino: '#0f172a',
  navy: '#0f172a',
  azul: '#2563eb',
  blue: '#2563eb',
  rojo: '#dc2626',
  red: '#dc2626',
  verde: '#16a34a',
  green: '#16a34a',
  rosa: '#f472b6',
  pink: '#f472b6',
  amarillo: '#eab308',
  yellow: '#eab308',
  naranja: '#f97316',
  orange: '#f97316',
  marron: '#78350f',
  marrón: '#78350f',
  brown: '#78350f',
  bordo: '#831843',
  bordó: '#831843',
  vino: '#581c87',
  'color surtido': '#94a3b8',
}

export interface ProductDetailInteractiveProps {
  product: PublicProduct
  isWholesale: boolean
  hasDiscount: boolean
  discountPercent: number
  installmentPlans: InstallmentPlanOption[]
  branchStock: BranchStockInfo[]
}

export function ProductDetailInteractive({
  product,
  isWholesale,
  hasDiscount,
  discountPercent,
  installmentPlans,
  branchStock,
}: ProductDetailInteractiveProps) {
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
  const variants = useMemo(() => product.variants || [], [product.variants])

  // Pre-seleccionar la primera variante disponible con stock, o la primera activa
  const defaultVariant = useMemo(() => {
    if (!hasVariants || variants.length === 0) return null
    return variants.find((v) => v.stock_quantity > 0) || variants[0] || null
  }, [hasVariants, variants])

  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>(() => {
    if (defaultVariant?.attributes) {
      const initialAttrs: Record<string, string> = {}
      for (const [k, v] of Object.entries(defaultVariant.attributes)) {
        if (k !== 'image_url') initialAttrs[k] = v
      }
      return initialAttrs
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
    return (
      variants.find((v) => {
        return Object.entries(selectedAttributes).every(
          ([key, val]) => v.attributes[key] === val
        )
      }) || null
    )
  }, [hasVariants, variants, selectedAttributes])

  // Lista de imágenes consolidadas de producto y variantes
  const galleryImages = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []

    const addImg = (rawUrl?: string | null) => {
      if (!rawUrl) return
      const resolved = resolveProductImageUrl(rawUrl)
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved)
        list.push(resolved)
      }
    }

    addImg(product.image)
    if (Array.isArray(product.images)) {
      product.images.forEach(addImg)
    }
    // Agregar imágenes de las variantes
    variants.forEach((v) => {
      if (v.image_url) addImg(v.image_url)
      if (v.attributes?.image_url) addImg(v.attributes.image_url)
    })

    return list.length > 0 ? list : ['/placeholder-product.svg']
  }, [product.image, product.images, variants])

  const [selectedImage, setSelectedImage] = useState(0)
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({})

  // Sincronizar imagen cuando cambia la variante o el color seleccionado
  useEffect(() => {
    if (!selectedVariant && Object.keys(selectedAttributes).length === 0) return

    // 1. Verificar si la variante seleccionada tiene una imagen directa
    const selectedVariantImage = selectedVariant?.image_url || selectedVariant?.attributes?.image_url
    const variantImg = selectedVariantImage
      ? resolveProductImageUrl(selectedVariantImage)
      : null

    if (variantImg) {
      const idx = galleryImages.findIndex((img) => img === variantImg)
      if (idx !== -1) {
        setSelectedImage(idx)
        return
      }
    }

    // 2. Si no, verificar si alguna variante con el mismo color tiene imagen
    const currentColor = selectedAttributes['color'] || selectedAttributes['Color']
    if (currentColor) {
      const matchingColorVariant = variants.find(
        (v) =>
          (v.attributes?.color?.toLowerCase() === currentColor.toLowerCase() ||
            v.attributes?.Color?.toLowerCase() === currentColor.toLowerCase()) &&
          (v.image_url || v.attributes?.image_url)
      )
      const matchingColorImage = matchingColorVariant?.image_url || matchingColorVariant?.attributes?.image_url
      const colorImg = matchingColorImage
        ? resolveProductImageUrl(matchingColorImage)
        : null

      if (colorImg) {
        const idx = galleryImages.findIndex((img) => img === colorImg)
        if (idx !== -1) {
          setSelectedImage(idx)
        }
      }
    }
  }, [selectedVariant, selectedAttributes, galleryImages, variants])

  // Al hacer clic en un thumbnail de la galería, si pertenece a un color, seleccionar ese color
  const handleThumbnailClick = useCallback(
    (index: number) => {
      setSelectedImage(index)
      const clickedUrl = galleryImages[index]
      if (!clickedUrl) return

      // Buscar si alguna variante tiene esta imagen asociada
      const matchingVar = variants.find(
        (v) =>
          (v.image_url && resolveProductImageUrl(v.image_url) === clickedUrl) ||
          (v.attributes?.image_url && resolveProductImageUrl(v.attributes.image_url) === clickedUrl)
      )

      if (matchingVar?.attributes) {
        const colorVal = matchingVar.attributes.color || matchingVar.attributes.Color
        if (colorVal) {
          setSelectedAttributes((prev) => ({
            ...prev,
            color: colorVal,
          }))
        }
      }
    },
    [galleryImages, variants]
  )

  const handleSelectOption = (attrKey: string, optionValue: string) => {
    setSelectedAttributes((prev) => ({
      ...prev,
      [attrKey]: optionValue,
    }))
  }

  // Estado de stock y precio según la variante seleccionada
  const isInStock = hasVariants
    ? Boolean(selectedVariant && selectedVariant.stock_quantity > 0)
    : product.in_stock

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
  const commerceMode = settings?.checkout?.commerceMode ?? 'cart'
  const phoneDisplay = companyInfo?.whatsapp || companyInfo?.phone || envSupportPhone
  const phoneClean = phoneDisplay?.replace(/\D/g, '')
  const emailDisplay = companyInfo?.email || envSupportEmail

  const handleAddToCart = () => {
    if (commerceMode !== 'cart') return
    if (!isInStock) {
      toast.error('Esta combinación no tiene stock disponible')
      return
    }

    const result = addProduct(product, displayPrice, 1, selectedVariant || undefined)
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
    const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
    const activePhoto = galleryImages[selectedImage] || product.image || ''
    const colorAttr = selectedAttributes['color'] || selectedAttributes['Color']
    const sizeAttr =
      selectedAttributes['size'] ||
      selectedAttributes['talle'] ||
      selectedAttributes['Talle'] ||
      selectedAttributes['Size']

    let variantDetails = ''
    if (selectedVariant) {
      if (colorAttr && sizeAttr) {
        variantDetails = `🎨 *Color:* ${colorAttr}\n📏 *Talle:* ${sizeAttr}`
      } else {
        variantDetails = `✨ *Opción:* ${selectedVariant.variant_name}`
      }
    } else if (Object.keys(selectedAttributes).length > 0) {
      variantDetails = Object.entries(selectedAttributes)
        .map(([k, v]) => `• *${k}:* ${v}`)
        .join('\n')
    }

    const priceFormatted = formatPrice(displayPrice)
    const originalPriceFormatted = formatPrice(product.sale_price)
    const priceText = `💰 *Precio:* ${priceFormatted}${
      hasDiscount ? ` ~(Antes: ${originalPriceFormatted})~` : ''
    }`
    const skuText = `🏷️ *SKU:* ${currentSku}`
    const stockText = `📦 *Disponibilidad:* ${
      isInStock ? `En stock (${currentStockQuantity} unid.)` : 'Agotado (consultar reposición)'
    }`

    const messageLines = [
      `¡Hola! 👋 Me interesa este producto en su tienda:`,
      ``,
      `🛍️ *${product.name}*`,
      ...(variantDetails ? [variantDetails] : []),
      priceText,
      skuText,
      stockText,
      ``,
      ...(currentUrl ? [`🔗 *Ver en la web:* ${currentUrl}`] : []),
      ...(activePhoto && !activePhoto.startsWith('data:') && activePhoto !== '/placeholder-product.svg'
        ? [`🖼️ *Foto:* ${activePhoto}`]
        : []),
      ``,
      `¿Tienen disponibilidad para envío o retiro? ¡Muchas gracias!`,
    ]

    const message = messageLines.join('\n')

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
          toast.error('No hay un número de WhatsApp configurado para la tienda')
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
          toast.error('No hay teléfono de contacto configurado')
        }
        break
    }
  }

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Mirá este producto: ${product.name}`,
          url: window.location.href,
        })
      } catch {
        // Cancelado por el usuario
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(window.location.href)
        toast.success('Enlace copiado al portapapeles')
      } catch {
        toast.error('No se pudo copiar el enlace automáticamente')
      }
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* ── COLUMNA IZQUIERDA: GALERÍA DE IMÁGENES ── */}
      <div className="space-y-4">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted/40 shadow-xs">
          {galleryImages.length > 0 && !imageErrors[selectedImage] ? (
            <Image
              src={galleryImages[selectedImage]!}
              alt={product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain p-4 transition-all duration-300"
              priority
              onError={() => setImageErrors((prev) => ({ ...prev, [selectedImage]: true }))}
              unoptimized={
                galleryImages[selectedImage]!.startsWith('data:') ||
                galleryImages[selectedImage]! === '/placeholder-product.svg'
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-muted/20">
              <Package className="h-24 w-24 text-muted-foreground/20" />
            </div>
          )}

          {/* Botón de compartir */}
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-3 top-3 h-9 w-9 rounded-full shadow-md bg-background/80 backdrop-blur-sm border-0 hover:bg-background"
            onClick={handleShare}
            aria-label="Compartir producto"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          {/* Badges de producto */}
          <div className="absolute left-3 top-3 flex flex-col gap-1.5 pointer-events-none">
            {product.featured && (
              <Badge className="bg-foreground text-background border-0 text-xs shadow-sm font-medium">
                Destacado
              </Badge>
            )}
            {hasDiscount && (
              <Badge className="bg-rose-600 text-white border-0 text-xs shadow-sm font-semibold">
                -{discountPercent}% OFF
              </Badge>
            )}
          </div>
        </div>

        {/* Thumbnails con sincronización */}
        {galleryImages.length > 1 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            {galleryImages.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleThumbnailClick(i)}
                aria-label={`Ver imagen ${i + 1} de ${galleryImages.length}`}
                aria-pressed={selectedImage === i}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                  selectedImage === i
                    ? 'border-primary ring-2 ring-primary/20 scale-[1.03] shadow-sm'
                    : 'border-border/60 hover:border-border opacity-70 hover:opacity-100'
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

      {/* ── COLUMNA DERECHA: INFORMACIÓN Y ACCIONES ── */}
      <div className="flex flex-col gap-6">
        {/* Encabezado */}
        <div>
          {product.brand && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {product.brand}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground lg:text-3xl text-balance">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge
              variant={isInStock ? 'secondary' : 'destructive'}
              className="gap-1.5 text-xs rounded-full font-medium"
            >
              {isInStock ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  En stock {currentStockQuantity > 0 && `(${currentStockQuantity} unid.)`}
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

            {hasDiscount && (
              <Badge className="gap-1 bg-rose-600 text-white text-xs rounded-full font-semibold">
                <Tag className="h-3 w-3" />
                -{discountPercent}% OFERTA
              </Badge>
            )}

            {isWholesale && product.wholesale_price && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs rounded-full font-medium">
                Precio Mayorista
              </Badge>
            )}
          </div>
        </div>

        {/* Tarjeta de Precio */}
        <div className="rounded-2xl border border-border p-5 bg-card/50">
          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-extrabold text-foreground tracking-tight">
              {formatPrice(displayPrice)}
            </p>
            {hasDiscount && (
              <p className="text-lg text-muted-foreground line-through decoration-muted-foreground/60">
                {formatPrice(product.sale_price)}
              </p>
            )}
          </div>

          {installmentPlans.length > 0 && (
            <InstallmentSelector
              price={displayPrice}
              plans={installmentPlans}
              className="mt-4"
            />
          )}
        </div>

        {/* ── SELECTOR DE VARIANTES SINCRONIZADO ── */}
        {hasVariants && attributeConfigs.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs space-y-4">
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

            <div className="space-y-4">
              {attributeConfigs.map((attr) => {
                const selectedValue = selectedAttributes[attr.key]
                const isColorAttr =
                  attr.control === 'color' ||
                  attr.key.toLowerCase().includes('color') ||
                  attr.key.toLowerCase().includes('colour')

                return (
                  <div key={attr.key} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {attr.label}:
                      </span>
                      {selectedValue && (
                        <span className="font-bold text-primary">
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
                        const colorHex = isColorAttr ? COLOR_HEX_MAP[option.toLowerCase()] : null

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleSelectOption(attr.key, option)}
                            className={cn(
                              'relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all select-none',
                              isSelected
                                ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20 scale-[1.02]'
                                : optionHasStock
                                ? 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                : 'border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 line-through opacity-70'
                            )}
                          >
                            {/* Círculo de color visual si es atributo de color */}
                            {colorHex && (
                              <span
                                className={cn(
                                  'h-3.5 w-3.5 rounded-full shadow-xs shrink-0',
                                  option.toLowerCase() === 'blanco' || option.toLowerCase() === 'white'
                                    ? 'border border-slate-300'
                                    : 'border border-black/10'
                                )}
                                style={{ backgroundColor: colorHex }}
                              />
                            )}
                            {isSelected && !colorHex && <span className="text-[10px]">✓</span>}
                            <span>{option}</span>
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
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium text-[11px]"
                    >
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

        {/* Descripción */}
        {product.description && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Descripción
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        )}

        {/* Detalles del producto */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Detalles
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {product.brand && (
              <div>
                <dt className="text-muted-foreground">Marca</dt>
                <dd className="font-medium text-foreground">{product.brand}</dd>
              </div>
            )}
            {product.category && (
              <div>
                <dt className="text-muted-foreground">Categoría</dt>
                <dd className="font-medium text-foreground">{product.category.name}</dd>
              </div>
            )}
            {currentSku && (
              <div>
                <dt className="text-muted-foreground">SKU / Código</dt>
                <dd className="font-mono text-foreground text-xs">{currentSku}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* ── CARD DE ACCIONES: CARRITO Y WHATSAPP MEJORADO ── */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-xs">
          <h3 className="font-semibold text-foreground">
            {isInStock ? '¿Te interesa este producto?' : 'Combinación temporalmente agotada'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isInStock
              ? 'Agregalo a tu carrito o contactanos directamente por WhatsApp con el producto y variante listos.'
              : 'Contactanos para consultar fecha de reposición o modelos similares.'}
          </p>

          <div className="mt-4 flex flex-col gap-2.5">
            {commerceMode === 'cart' && (
              <Button
                size="lg"
                className="w-full gap-2 rounded-xl text-sm font-semibold shadow-xs"
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
                'w-full gap-2 rounded-xl text-sm font-semibold transition-all',
                commerceMode === 'whatsapp'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                  : 'border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
              )}
              onClick={() => handleContact('whatsapp')}
            >
              <MessageCircle className="h-4 w-4" />
              {isInStock ? 'Consultar / Pedir por WhatsApp' : 'Consultar reposición por WhatsApp'}
            </Button>

            {commerceMode === 'cart' && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl text-xs"
                  onClick={() => handleContact('email')}
                  disabled={!emailDisplay}
                >
                  <Mail className="h-4 w-4" />
                  Email
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl text-xs"
                  onClick={() => handleContact('phone')}
                  disabled={!phoneClean}
                >
                  <Phone className="h-4 w-4" />
                  Llamar
                </Button>
              </div>
            )}

            {!isInStock && (
              <Button asChild variant="secondary" className="w-full rounded-xl text-xs">
                <Link
                  href={
                    product.category
                      ? `${tenantPrefix}/productos?category_id=${product.category.id}`
                      : `${tenantPrefix}/productos`
                  }
                >
                  Ver productos similares
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Disponibilidad por sucursales */}
        <BranchAvailability branches={branchStock} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES INDIVIDUALES EXPORTADOS PARA RETROCOMPATIBILIDAD
// ─────────────────────────────────────────────────────────────────────────────

interface ProductGalleryProps {
  product: PublicProduct
  hasDiscount: boolean
  discountPercent: number
}

export function ProductGallery({ product, hasDiscount, discountPercent }: ProductGalleryProps) {
  return (
    <ProductDetailInteractive
      product={product}
      isWholesale={false}
      hasDiscount={hasDiscount}
      discountPercent={discountPercent}
      installmentPlans={[]}
      branchStock={[]}
    />
  )
}

interface ProductActionsProps {
  product: PublicProduct
  isInStock: boolean
}

export function ProductActions({ product, isInStock }: ProductActionsProps) {
  return null
}
