'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock, ExternalLink, LogIn, Mail, MapPin, Package, Phone, Scissors, ShieldCheck, ShoppingBag, Tag, Truck, UserPlus } from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/components/public/SocialIcons'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { loginHrefWithReturn } from '@/lib/auth/dashboard-access'
import { socialProfileUrl } from '@/lib/public/social-links'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { getCompanyMapsHref } from '@/lib/website/company-maps-url'
import { isPublicRepairsAvailable, isPublicServicesPageAvailable } from '@/lib/website/services'
import type { WebsiteSettings } from '@/types/website-settings'

interface EspecialBarberoFooterProps {
  initialSettings?: WebsiteSettings | null
  repairsModuleEnabled?: boolean
  servicesModuleEnabled?: boolean
}

export function EspecialBarberoFooter({
  initialSettings = null,
  repairsModuleEnabled = false,
  servicesModuleEnabled = true,
}: EspecialBarberoFooterProps) {
  const pathname = usePathname()
  const { settings } = useWebsiteSettings()
  const effectiveSettings = settings ?? initialSettings
  const company = useStorefrontCompanyInfo(effectiveSettings?.company_info)
  const { categories } = usePublicCategories()

  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''
  const storeName = company?.name?.trim() || 'Barber Supply'
  const slogan = company?.slogan?.trim() || ''
  const logoUrl = company?.logoUrl?.trim() || ''
  const phone = company?.phone?.trim() || ''
  const email = company?.email?.trim() || ''
  const address = company?.address?.trim() || ''
  const mapsHref = getCompanyMapsHref(company?.mapsUrl, address)
  const rawWhatsapp = (company?.whatsapp || company?.phone || '').trim()
  const whatsappClean = rawWhatsapp.replace(/\D/g, '')
  const whatsappHref = whatsappClean ? `https://wa.me/${whatsappClean}` : ''

  const instagramUrl = company?.instagram ? socialProfileUrl(company.instagram, 'instagram') : ''
  const facebookUrl = company?.facebook ? socialProfileUrl(company.facebook, 'facebook') : ''
  const tiktokUrl = company?.tiktok ? socialProfileUrl(company.tiktok, 'tiktok') : ''

  const offersEnabled = effectiveSettings?.offers_section?.enabled !== false
  const servicesEnabled =
    servicesModuleEnabled &&
    isPublicServicesPageAvailable(company?.servicesPageEnabled, effectiveSettings?.services)
  const repairsEnabled =
    repairsModuleEnabled &&
    isPublicRepairsAvailable(company, effectiveSettings?.services)

  const loginHref = loginHrefWithReturn(
    slug ? `${prefix}/cliente/login` : '/login',
    pathname,
    slug ? 'next' : 'redirect'
  )
  const registerHref = slug ? `${prefix}/cliente/registro` : '/register'

  const topCategories = topRootCategories(categories)
  const paymentLabels = configuredPaymentLabels(effectiveSettings?.checkout)

  return (
    <footer
      data-especial-barbero-footer
      className="relative overflow-hidden bg-[#09090D] text-zinc-200"
    >
      {/* Borde superior con acento dinámico de la organización */}
      <div
        className="h-[3px] w-full"
        style={{
          background:
            'linear-gradient(90deg, var(--primary), color-mix(in oklch, var(--primary) 82%, #f97316 18%))',
        }}
      />

      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Columna 1: Identidad y Redes */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-primary/40 bg-white p-1">
                  <AppImage src={logoUrl} alt={storeName} fill className="object-contain" />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Scissors className="h-5 w-5" />
                </div>
              )}
              <span className="text-lg font-black uppercase tracking-tight text-white">
                {storeName}
              </span>
            </div>

            {slogan && (
              <p className="text-xs leading-relaxed text-zinc-400">
                {slogan}
              </p>
            )}

            {(instagramUrl || facebookUrl || tiktokUrl || whatsappHref) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="ebs-social-btn flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-zinc-200"
                  >
                    <InstagramIcon className="h-4 w-4" />
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                    className="ebs-social-btn flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-zinc-200"
                  >
                    <FacebookIcon className="h-4 w-4" />
                  </a>
                )}
                {tiktokUrl && (
                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TikTok"
                    className="ebs-social-btn flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-zinc-200"
                  >
                    <TikTokIcon className="h-4 w-4" />
                  </a>
                )}
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="ebs-social-btn flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/15 text-emerald-400"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Columna 2: Catálogo & Categorías */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary">
              Tienda &amp; Categorías
            </h3>
            <ul className="space-y-2 text-xs text-zinc-300">
              <li>
                <Link href={`${prefix}/inicio`} className="hover:text-primary transition-colors">
                  Inicio
                </Link>
              </li>
              <li>
                <Link href={`${prefix}/productos`} className="hover:text-primary transition-colors inline-flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-primary/80" />
                  <span>Todos los productos</span>
                </Link>
              </li>
              {offersEnabled && (
                <li>
                  <Link href={`${prefix}/ofertas`} className="hover:text-primary transition-colors inline-flex items-center gap-1.5 font-bold text-primary">
                    <Tag className="h-3.5 w-3.5" />
                    <span>Ofertas y promociones</span>
                  </Link>
                </li>
              )}
              {topCategories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`${prefix}/productos?category_id=${encodeURIComponent(cat.id)}`}
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Columna 3: Portal Minorista / Mayorista */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary">
              Clientes &amp; Mayoristas
            </h3>
            <ul className="space-y-2 text-xs text-zinc-300">
              <li>
                <Link href={loginHref} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                  <LogIn className="h-3.5 w-3.5 text-primary/80" />
                  <span>Iniciar sesión</span>
                </Link>
              </li>
              <li>
                <Link href={registerHref} className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Cuenta mayorista / registro</span>
                </Link>
              </li>
              <li>
                <Link href={`${prefix}/perfil?tab=orders`} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                  <ShoppingBag className="h-3.5 w-3.5 text-primary/80" />
                  <span>Mis pedidos</span>
                </Link>
              </li>
              <li>
                <Link href={`${prefix}/track`} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Truck className="h-3.5 w-3.5 text-primary/80" />
                  <span>Rastrear pedido</span>
                </Link>
              </li>
              {servicesEnabled && (
                <li>
                  <Link href={`${prefix}/servicios`} className="hover:text-primary transition-colors">
                    Servicios y reservas
                  </Link>
                </li>
              )}
              {repairsEnabled && (
                <li>
                  <Link href={`${prefix}/mis-reparaciones`} className="inline-flex items-center gap-1.5 hover:text-primary transition-colors">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary/80" />
                    <span>Mis reparaciones</span>
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Columna 4: Contacto & Horarios reales */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary">
              Contacto &amp; Horarios
            </h3>
            <ul className="space-y-2.5 text-xs text-zinc-300">
              {phone && (
                <li className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <a href={`tel:${phone.replace(/\D/g, '')}`} className="hover:text-white transition-colors">
                    {phone}
                  </a>
                </li>
              )}
              {email && (
                <li className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <a href={`mailto:${email}`} className="break-all hover:text-white transition-colors">
                    {email}
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {mapsHref ? (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-white hover:underline"
                    >
                      <span>{address}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                    </a>
                  ) : (
                    <span>{address}</span>
                  )}
                </li>
              )}
              {(company?.hours?.weekdays || company?.hours?.saturday || company?.hours?.sunday) && (
                <li className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div className="space-y-0.5 text-zinc-400">
                    {company?.hours?.weekdays && <p>{company.hours.weekdays}</p>}
                    {company?.hours?.saturday && <p>Sáb: {company.hours.saturday}</p>}
                    {company?.hours?.sunday && <p>Dom: {company.hours.sunday}</p>}
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Franja inferior de pagos configurados y copyright */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-zinc-400">
          {paymentLabels.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-zinc-300">Medios habilitados:</span>
              {paymentLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-md border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-200"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <div />
          )}

          <div className="flex flex-wrap items-center gap-4">
            <p>© {new Date().getFullYear()} {storeName}</p>
            <LegalFooterLinks />
          </div>
        </div>
      </div>
    </footer>
  )
}

function topRootCategories(categories: Array<{ id: string; name: string; parent_id?: string | null; productCount?: number }>) {
  return categories
    .filter((cat) => !cat.parent_id)
    .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0))
    .slice(0, 4)
}

function configuredPaymentLabels(checkout?: WebsiteSettings['checkout']) {
  if (!checkout) return ['Efectivo', 'Transferencia', 'Tarjetas']
  const labels: string[] = []
  if (checkout.payment?.cash?.enabled !== false) labels.push('Efectivo')
  if (checkout.payment?.transfer?.enabled !== false) labels.push('Transferencia')
  if (checkout.payment?.card?.enabled) labels.push('Tarjetas')
  if (checkout.payment?.digital_wallet?.enabled) labels.push('Billetera / QR')
  if (checkout.delivery?.enabled) labels.push('Envíos')
  if (checkout.pickup?.enabled !== false) labels.push('Retiro en local')
  return labels
}
