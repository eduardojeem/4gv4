'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Check,
  Clock,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Phone,
  Share2,
  ShieldCheck,
  Star,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RUBRO_LABELS } from '@/components/public/OrganizationDirectoryCard'
import { normalizeCity } from '@/lib/public/city-normalizer'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'
import { cn } from '@/lib/utils'

type Props = {
  organization: MarketplaceOrganization | null
  open: boolean
  onClose: () => void
}

const BRAND_HEADER_GRADIENTS: Record<string, string> = {
  blue: 'from-blue-600/15 via-blue-500/5 to-muted/20',
  green: 'from-emerald-600/15 via-teal-500/5 to-muted/20',
  purple: 'from-purple-600/15 via-fuchsia-500/5 to-muted/20',
  orange: 'from-orange-600/15 via-amber-500/5 to-muted/20',
  red: 'from-rose-600/15 via-red-500/5 to-muted/20',
  indigo: 'from-indigo-600/15 via-blue-500/5 to-muted/20',
  teal: 'from-teal-600/15 via-emerald-500/5 to-muted/20',
  rose: 'from-rose-600/15 via-pink-500/5 to-muted/20',
  amber: 'from-amber-500/20 via-yellow-500/10 to-muted/20',
  yellow: 'from-amber-500/20 via-yellow-500/10 to-muted/20',
  emerald: 'from-emerald-600/15 via-teal-500/5 to-muted/20',
  cyan: 'from-cyan-600/15 via-sky-500/5 to-muted/20',
  sky: 'from-sky-500/15 via-blue-500/5 to-muted/20',
}

const BRAND_AVATAR_GRADIENTS: Record<string, string> = {
  blue: 'from-blue-600 to-blue-800',
  green: 'from-emerald-600 to-teal-700',
  purple: 'from-purple-600 to-pink-700',
  orange: 'from-orange-600 to-amber-700',
  red: 'from-rose-600 to-red-800',
  indigo: 'from-indigo-600 to-blue-800',
  teal: 'from-teal-600 to-emerald-700',
  rose: 'from-rose-600 to-pink-700',
  amber: 'from-amber-500 to-orange-600',
  yellow: 'from-amber-500 to-yellow-600',
  emerald: 'from-emerald-600 to-teal-700',
  cyan: 'from-cyan-600 to-sky-700',
  sky: 'from-sky-500 to-blue-700',
}

export function OrganizationDetailModal({ organization, open, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  if (!organization) return null

  const storeUrl = `/${organization.slug}/inicio`
  const catalogUrl = `/${organization.slug}/productos`
  const rubroKey = organization.rubro || 'comercio'
  const rubroMeta = RUBRO_LABELS[rubroKey] ?? RUBRO_LABELS.comercio
  const RubroIcon = rubroMeta.icon
  const normalizedCity = normalizeCity(organization.city)

  const brandColorKey = organization.brand_color || 'blue'
  const brandGradient = BRAND_HEADER_GRADIENTS[brandColorKey] ?? 'from-primary/15 via-primary/5 to-muted/20'
  const brandAvatar = BRAND_AVATAR_GRADIENTS[brandColorKey] ?? 'from-primary to-primary/80'

  // Mensaje y enlace directo a WhatsApp
  const rawPhone = organization.whatsapp || organization.phone || ''
  const cleanPhone = rawPhone.replace(/\D/g, '')
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith('595') ? cleanPhone : `595${cleanPhone.replace(/^0/, '')}`}?text=${encodeURIComponent(`¡Hola ${organization.name}! Vi su tienda en el Marketplace y quería hacer una consulta.`)}`
    : null

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}${storeUrl}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleShare = () => {
    const fullUrl = `${window.location.origin}${storeUrl}`
    if (navigator.share) {
      navigator.share({
        title: organization.name,
        text: organization.slogan || organization.description || `Conocé los productos de ${organization.name} en el Marketplace`,
        url: fullUrl,
      }).catch(() => {})
    } else {
      handleCopyLink()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 gap-0 border-border/80 bg-card rounded-2xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* ── Header Visual con Identidad de Marca ── */}
        <div
          className={cn('relative bg-gradient-to-br p-6 sm:p-7 border-b border-border/70 shrink-0', brandGradient)}
          style={organization.custom_brand_color ? {
            background: `linear-gradient(135deg, ${organization.custom_brand_color}25 0%, ${organization.custom_brand_color}0a 60%, transparent 100%)`
          } : undefined}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Logo de la Empresa */}
            <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-background/80 bg-card p-1.5 shadow-md">
              {organization.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div
                  className={cn('flex h-full w-full items-center justify-center rounded-xl font-black text-xl text-white shadow-2xs bg-gradient-to-br', brandAvatar)}
                  style={organization.custom_brand_color ? { backgroundColor: organization.custom_brand_color } : undefined}
                >
                  {organization.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Badges de Rubro y Calificación */}
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold', rubroMeta.color)}>
                <RubroIcon className="h-3.5 w-3.5" />
                <span>{rubroMeta.label}</span>
              </span>

              {(organization.review_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span>{Number(organization.review_rating_avg ?? 0).toFixed(1)}</span>
                  <span className="text-[10px] font-normal opacity-80">({organization.review_count})</span>
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <span>{organization.name}</span>
              <span title="Empresa Verificada"><ShieldCheck className="h-5 w-5 text-primary shrink-0" /></span>
            </DialogTitle>

            <DialogDescription className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="font-mono text-primary font-medium">/{organization.slug}</span>
              {organization.slogan && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="italic text-foreground/80">&ldquo;{organization.slogan}&rdquo;</span>
                </>
              )}
            </DialogDescription>
          </div>
        </div>

        {/* ── Contenido con Scroll ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* ── Botones de Contacto Rápido ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white px-3 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-all shadow-2xs"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>WhatsApp</span>
              </a>
            ) : null}

            {organization.phone ? (
              <a
                href={`tel:${organization.phone}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary px-3 py-2.5 text-xs font-bold text-foreground transition-all shadow-2xs"
              >
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span>Llamar</span>
              </a>
            ) : null}

            {organization.email ? (
              <a
                href={`mailto:${organization.email}`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary px-3 py-2.5 text-xs font-bold text-foreground transition-all shadow-2xs"
              >
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <span>Email</span>
              </a>
            ) : null}

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary px-3 py-2.5 text-xs font-bold text-foreground transition-all shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4 text-primary" />}
              <span>{copied ? '¡Copiado!' : 'Compartir'}</span>
            </button>
          </div>

          {/* ── Acerca de la Empresa / Descripción ── */}
          {(organization.description || organization.slogan) && (
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5 space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Acerca de la empresa</span>
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {organization.description || organization.slogan}
              </p>
            </div>
          )}

          {/* ── Ubicación & Mapa ── */}
          {(normalizedCity || organization.address) && (
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground">Ubicación y Dirección</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {normalizedCity && <strong className="text-foreground font-semibold">{normalizedCity.display}, Paraguay. </strong>}
                      {organization.address}
                    </p>
                  </div>
                </div>

                {organization.maps_url && (
                  <a
                    href={organization.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-2xs"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    <span>Abrir Mapa</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Horarios de Atención ── */}
          {organization.hours && (organization.hours.weekdays || organization.hours.saturday) && (
            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>Horarios de Atención</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {organization.hours.weekdays && (
                  <div className="rounded-xl bg-muted/30 p-2.5 border border-border/40">
                    <p className="font-semibold text-foreground text-[11px]">Lunes a Viernes</p>
                    <p className="text-muted-foreground mt-0.5">{organization.hours.weekdays}</p>
                  </div>
                )}
                {organization.hours.saturday && (
                  <div className="rounded-xl bg-muted/30 p-2.5 border border-border/40">
                    <p className="font-semibold text-foreground text-[11px]">Sábados</p>
                    <p className="text-muted-foreground mt-0.5">{organization.hours.saturday}</p>
                  </div>
                )}
                {organization.hours.sunday && (
                  <div className="rounded-xl bg-muted/30 p-2.5 border border-border/40">
                    <p className="font-semibold text-foreground text-[11px]">Domingos</p>
                    <p className="text-muted-foreground mt-0.5">{organization.hours.sunday}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Redes Sociales y Canales Oficiales ── */}
          {(organization.instagram || organization.facebook || organization.tiktok) && (
            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Globe className="h-4 w-4 text-primary" />
                <span>Redes Sociales y Canales Oficiales</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {organization.instagram && (
                  <a
                    href={`https://instagram.com/${organization.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-pink-500/20 bg-pink-500/5 hover:bg-pink-500/15 p-2.5 text-xs font-medium text-foreground transition-all hover:border-pink-500/40 group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
                      <InstagramIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-pink-600 dark:text-pink-400">Instagram</p>
                      <p className="truncate text-xs font-semibold text-foreground">@{organization.instagram.replace(/^@/, '')}</p>
                    </div>
                  </a>
                )}

                {organization.facebook && (
                  <a
                    href={organization.facebook.startsWith('http') ? organization.facebook : `https://facebook.com/${organization.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/15 p-2.5 text-xs font-medium text-foreground transition-all hover:border-blue-500/40 group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1877F2] text-white shadow-2xs group-hover:scale-105 transition-transform">
                      <FacebookIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Facebook</p>
                      <p className="truncate text-xs font-semibold text-foreground">
                        {organization.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, '').replace(/\/$/, '') || 'Página Oficial'}
                      </p>
                    </div>
                  </a>
                )}

                {organization.tiktok && (
                  <a
                    href={`https://tiktok.com/@${organization.tiktok.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 p-2.5 text-xs font-medium text-foreground transition-all hover:border-foreground/30 group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white shadow-2xs group-hover:scale-105 transition-transform">
                      <TikTokIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-foreground">TikTok</p>
                      <p className="truncate text-xs font-semibold text-foreground">@{organization.tiktok.replace(/^@/, '')}</p>
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── Catálogo Destacado ── */}
          {organization.featured_products && organization.featured_products.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-primary" />
                  <span>Productos Destacados</span>
                  <span className="text-muted-foreground font-normal">({organization.products_count} en total)</span>
                </h4>

                <Link
                  href={catalogUrl}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <span>Ver todos</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {organization.featured_products.slice(0, 3).map((prod) => {
                  const img = resolveProductImageUrl(prod.image)
                  const regularPrice = prod.sale_price ?? (prod as any).price ?? 0
                  const hasOffer = Boolean(
                    prod.has_offer &&
                    prod.offer_price != null &&
                    prod.offer_price > 0 &&
                    prod.offer_price < regularPrice
                  )
                  const displayPrice = hasOffer ? prod.offer_price! : regularPrice

                  return (
                    <Link
                      key={prod.id}
                      href={`/${organization.slug}/productos`}
                      className="group flex flex-col rounded-xl border border-border/70 bg-card p-2 text-center transition-all hover:border-primary/50 hover:shadow-xs"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted/30 mb-2">
                        {img ? (
                          <Image
                            src={img}
                            alt={prod.name}
                            fill
                            className="object-contain p-1 transition-transform group-hover:scale-105"
                            sizes="120px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/40" />
                          </div>
                        )}

                        {hasOffer && (
                          <span className="absolute top-1 right-1 rounded-md bg-rose-500 px-1 py-0.5 text-[9px] font-black text-white shadow-2xs">
                            OFERTA
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] font-bold text-foreground group-hover:text-primary">
                        {prod.name}
                      </p>
                      <div className="mt-0.5 flex items-center justify-center gap-1 flex-wrap">
                        <span className="text-[11px] font-black text-primary">
                          {formatPrice(displayPrice)}
                        </span>
                        {hasOffer && regularPrice > 0 && (
                          <span className="text-[9px] text-muted-foreground line-through opacity-70">
                            {formatPrice(regularPrice)}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-border/70 bg-muted/20 px-5 py-3.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl border-border text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </Button>

          <Button asChild size="sm" className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs">
            <Link href={storeUrl}>
              <span>Visitar Tienda Oficial</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.68 6.34 6.34 0 0 0 9.34 22a6.34 6.34 0 0 0 6.34-6.32V8.75a8.16 8.16 0 0 0 4.91 1.62V6.92a4.84 4.84 0 0 1-1-.23z" />
    </svg>
  )
}
