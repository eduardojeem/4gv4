'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Clock,
  Heart,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react'
import { AppImage } from '@/components/ui/app-image'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/components/public/SocialIcons'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { socialProfileUrl } from '@/lib/public/social-links'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { getCompanyMapsHref } from '@/lib/website/company-maps-url'
import type { WebsiteSettings } from '@/types/website-settings'
import './especial-cosmeticos.css'

interface EspecialCosmeticosFooterProps {
  initialSettings?: WebsiteSettings | null
}

export function EspecialCosmeticosFooter({ initialSettings = null }: EspecialCosmeticosFooterProps) {
  const pathname = usePathname()
  const { settings } = useWebsiteSettings()
  const effectiveSettings = settings ?? initialSettings
  const company = useStorefrontCompanyInfo(effectiveSettings?.company_info)
  const { categories } = usePublicCategories()

  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''
  const storeName = company?.name?.trim() || 'Glowora'
  const slogan = company?.slogan?.trim() || 'Alta Cosmética & Skincare'
  const logoUrl = company?.logoUrl?.trim() || ''
  const phone = company?.phone?.trim() || ''
  const email = company?.email?.trim() || ''
  const address = company?.address?.trim() || 'Avda. Santa Teresa c/ Herminio Maldonado, Asunción'
  const mapsHref = getCompanyMapsHref(company?.mapsUrl, address)

  const rawWhatsapp = (company?.whatsapp || company?.phone || '').trim()
  const whatsappClean = rawWhatsapp.replace(/\D/g, '')
  const whatsappHref = whatsappClean ? `https://wa.me/${whatsappClean}` : ''

  const instagramUrl = company?.instagram ? socialProfileUrl(company.instagram, 'instagram') : ''
  const facebookUrl = company?.facebook ? socialProfileUrl(company.facebook, 'facebook') : ''
  const tiktokUrl = company?.tiktok ? socialProfileUrl(company.tiktok, 'tiktok') : ''

  const hours = company?.hours ?? {
    weekdays: 'Lun a Vie: 08:30 - 19:30',
    saturday: 'Sáb: 09:00 - 18:00',
    sunday: 'Domingos cerrado',
  }

  return (
    <footer className="border-t border-rose-200/60 bg-[#FFFDFB] text-stone-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-stone-300">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Identidad de marca */}
          <div className="space-y-4">
            <Link href={`${prefix}/inicio`} className="flex items-center gap-3 group">
              {logoUrl ? (
                <div className="relative h-12 w-12 overflow-hidden rounded-full border border-rose-200 shadow-xs">
                  <AppImage src={logoUrl} alt={storeName} fill className="object-cover" />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-rose-100 via-pink-50 to-amber-100 border border-rose-200 shadow-xs">
                  <svg
                    className="h-6 w-6 text-rose-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3c-1.5 3-4 6-4 9a4 4 0 0 0 8 0c0-3-2.5-6-4-9z" />
                    <path d="M8 12c-2.5-1.5-5-1-6 1 1 3 4 4 6 3" />
                    <path d="M16 12c2.5-1.5 5-1 6 1-1 3-4 4-6 3" />
                    <path d="M10 18c-2 2-5 2-7 1 1.5-2 3.5-2.5 6-1.5" />
                    <path d="M14 18c2 2 5 2 7 1-1.5-2-3.5-2.5-6-1.5" />
                    <path d="M12 18v3" />
                  </svg>
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
                  {storeName}
                </span>
                <span className="text-[10px] font-medium tracking-[0.18em] uppercase text-rose-600 dark:text-rose-400">
                  {slogan}
                </span>
              </div>
            </Link>
            <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-400">
              Cosmética dermatológica y skincare de alta gama. Fórmulas botánicas seleccionadas para realzar tu belleza natural con resultados visibles y seguros.
            </p>
            {/* Redes sociales */}
            <div className="flex items-center gap-2 pt-2">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-zinc-800 dark:text-rose-400 transition-colors"
                  aria-label="Instagram"
                >
                  <InstagramIcon className="h-4 w-4" />
                </a>
              )}
              {facebookUrl && (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-blue-600 hover:bg-rose-100 dark:bg-zinc-800 dark:text-blue-400 transition-colors"
                  aria-label="Facebook"
                >
                  <FacebookIcon className="h-4 w-4" />
                </a>
              )}
              {tiktokUrl && (
                <a
                  href={tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-stone-900 hover:bg-rose-100 dark:bg-zinc-800 dark:text-white transition-colors"
                  aria-label="TikTok"
                >
                  <TikTokIcon className="h-4 w-4" />
                </a>
              )}
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-zinc-800 dark:text-emerald-400 transition-colors"
                  aria-label="WhatsApp"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* 2. Enlaces Rápidos */}
          <div className="space-y-3">
            <h3 className="font-serif text-sm font-bold tracking-wide uppercase text-stone-900 dark:text-stone-100">
              Navegación
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href={`${prefix}/inicio`} className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                  Inicio
                </Link>
              </li>
              <li>
                <Link href={`${prefix}/inicio#productos`} className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                  Tienda & Catálogo
                </Link>
              </li>
              <li>
                <Link href={`${prefix}/inicio#categorias`} className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                  Líneas de Cuidado
                </Link>
              </li>
              <li>
                <Link href={`${prefix}/ofertas`} className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                  Ofertas Especiales
                </Link>
              </li>
              <li>
                <Link href={`${prefix}/inicio#nosotros`} className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                  Nuestra Boutique
                </Link>
              </li>
              <li>
                <Link href={`${prefix}/inicio#ubicacion`} className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                  Ubicación & Mapa
                </Link>
              </li>
            </ul>
          </div>

          {/* 3. Horarios de Atención */}
          <div className="space-y-3">
            <h3 className="font-serif text-sm font-bold tracking-wide uppercase text-stone-900 dark:text-stone-100">
              Horarios del Local
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-200">Lunes a Viernes</p>
                  <p className="text-stone-500">{hours.weekdays || '08:30 a 19:30 hs'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-200">Sábados</p>
                  <p className="text-stone-500">{hours.saturday || '09:00 a 18:00 hs'}</p>
                </div>
              </div>
              {hours.sunday && (
                <div className="flex items-start gap-2">
                  <Clock className="h-3.5 w-3.5 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-stone-700 dark:text-stone-400">Domingos</p>
                    <p className="text-stone-500">{hours.sunday}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Contacto y Dirección */}
          <div className="space-y-3">
            <h3 className="font-serif text-sm font-bold tracking-wide uppercase text-stone-900 dark:text-stone-100">
              Atención & Ubicación
            </h3>
            <div className="space-y-2 text-xs">
              {address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-stone-600 dark:text-stone-400">{address}</p>
                    {mapsHref && (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 font-medium text-rose-600 hover:underline dark:text-rose-400"
                      >
                        Ver en Google Maps →
                      </a>
                    )}
                  </div>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <a href={`tel:${phone}`} className="hover:text-rose-600 transition-colors">
                    {phone}
                  </a>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-rose-600 transition-colors">
                    {email}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Barra inferior de copyright y enlaces legales */}
        <div className="mt-10 border-t border-rose-100 pt-6 text-center text-xs text-stone-500 dark:border-zinc-800 dark:text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} {storeName}. Todos los derechos reservados.</p>
          <LegalFooterLinks />
        </div>
      </div>
    </footer>
  )
}
