'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, ArrowRight, Store, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFavorites } from '@/lib/public/favorites-store'
import { formatPrice } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'

/**
 * `linkPrefix` es donde vive quien mira: `/marketplace`, `/una-tienda`, o vacio
 * en la vidriera por defecto. Los enlaces estaban fijos al marketplace, asi que
 * desde el perfil de una tienda «Ver todos» sacaba a la persona de la tienda.
 * La vidriera por defecto no tiene pagina de favoritos propia: ahi sigue yendo
 * a la del marketplace.
 */
export function ProfileFavoritesWidget({ linkPrefix = '' }: { linkPrefix?: string }) {
  const favoritesHref = linkPrefix ? `${linkPrefix}/favoritos` : '/marketplace/favoritos'
  const productsHref = linkPrefix ? `${linkPrefix}/productos` : '/marketplace/productos'
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false)
  const favoritesState = useFavorites()
  const items = useMemo(() => favoritesState?.items || [], [favoritesState])
  const [currentImages, setCurrentImages] = useState<Record<string, string>>({})

  useEffect(() => {
    const missing = items.filter((item) => !item.image)
    if (missing.length === 0) return
    const byStore = new Map<string, string[]>()
    for (const item of missing) byStore.set(item.slug, [...(byStore.get(item.slug) ?? []), item.productId])
    let active = true
    void Promise.all([...byStore].map(async ([slug, productIds]) => {
      const response = await fetch(`/api/public/favorites/metadata?org=${encodeURIComponent(slug)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productIds }),
      })
      if (!response.ok) return {}
      const body = await response.json() as { metadata?: Record<string, { image?: string | null }> }
      return Object.fromEntries(Object.entries(body.metadata ?? {}).flatMap(([id, metadata]) => metadata.image ? [[`${slug}:${id}`, metadata.image]] : []))
    })).then((groups) => { if (active) setCurrentImages(Object.assign({}, ...groups)) }).catch(() => undefined)
    return () => { active = false }
  }, [items])

  if (!mounted) return null

  return (
    <div id="favoritos" className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
            <Heart className="h-4 w-4 fill-rose-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Mis Productos Favoritos
            </h3>
            <p className="text-xs text-muted-foreground">
              Artículos que guardaste para comprar más adelante
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Badge variant="secondary" className="font-semibold text-xs">
              {items.length} {items.length === 1 ? 'producto' : 'productos'}
            </Badge>
          )}
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary">
            <Link href={favoritesHref}>
              Ver todos
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="p-5">
        {items.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <Heart className="mx-auto h-8 w-8 opacity-40 mb-2 text-rose-500" />
            <p className="text-sm font-medium text-foreground">Aún no tenés favoritos guardados</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Hacé clic en el corazón en cualquier producto del Marketplace o de las tiendas para guardarlo en tu lista personal.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 rounded-xl text-xs">
              <Link href={productsHref}>Explorar productos</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {items.slice(0, 4).map((fav) => {
              const currentImage = fav.image || currentImages[`${fav.slug}:${fav.productId}`]
              const imgUrl = currentImage ? resolveProductImageUrl(currentImage) : null
              const productHref = `/${fav.slug}/productos/${fav.productId}`

              return (
                <div
                  key={`${fav.slug}-${fav.productId}`}
                  className="group flex flex-col justify-between rounded-xl border border-border/80 bg-background/60 p-3 transition-all hover:border-rose-500/40 hover:shadow-xs"
                >
                  <div className="space-y-2">
                    {/* Imagen / Thumbnail */}
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted/40 flex items-center justify-center">
                      {imgUrl ? (
                        <Image
                          src={imgUrl}
                          alt={fav.name}
                          fill
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-contain p-2 transition-transform duration-200 group-hover:scale-105"
                          unoptimized
                        />
                      ) : (
                        <Package className="h-8 w-8 text-muted-foreground/50" />
                      )}
                    </div>

                    {/* Tienda */}
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Store className="h-3 w-3 text-primary" />
                      <span className="truncate">{fav.store || fav.slug}</span>
                    </div>

                    {/* Nombre */}
                    <Link
                      href={productHref}
                      className="line-clamp-2 text-xs font-bold text-foreground transition-colors hover:text-primary leading-snug"
                    >
                      {fav.name}
                    </Link>
                  </div>

                  <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-foreground">
                      {fav.price ? formatPrice(fav.price) : 'Consultar'}
                    </span>
                    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px] font-semibold rounded-lg">
                      <Link href={productHref}>
                        Ver
                      </Link>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
