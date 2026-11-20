'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Clock, Facebook, Instagram, Mail, MapPin, MessageCircle, Music2, Phone } from 'lucide-react'
import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getSocialLinks } from '@/lib/public/social-links'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import type { WebsiteSettings } from '@/types/website-settings'
import { categoryCards } from '@/components/public/especial-cosmeticos/cosmetics-home-data'
import './moda-femenina.css'

interface ModaFemeninaFooterProps {
  settings: WebsiteSettings | null
}

const SOCIAL_ICONS = { instagram: Instagram, facebook: Facebook, tiktok: Music2 } as const

/**
 * Pie de la plantilla «Boutique Femenina». Todo sale de lo que cargó el
 * comercio: nombre, eslogan, categorías con productos, contacto, horarios y
 * redes. Lo que no cargó no aparece (sin horarios ni promesas de ejemplo).
 */
export function ModaFemeninaFooter({ settings }: ModaFemeninaFooterProps) {
  const pathname = usePathname()
  const company = useStorefrontCompanyInfo(settings?.company_info)
  const { categories: liveCategories } = usePublicCategories()
  const slug = getTenantSlugFromPathname(pathname)
  const prefix = slug ? `/${slug}` : ''

  const storeName = company?.name?.trim() || 'Tienda'
  const about = company?.slogan?.trim() || company?.description?.trim() || ''
  const categories = categoryCards(liveCategories, prefix, 5)
  const socials = getSocialLinks(company)
  const phone = company?.phone?.trim() || ''
  const whatsapp = (company?.whatsapp || '').replace(/\D/g, '')
  const email = company?.email?.trim() || ''
  const address = company?.address?.trim() || ''
  const hours = [
    company?.hours?.weekdays?.trim() && `Lunes a viernes: ${company.hours.weekdays.trim()}`,
    company?.hours?.saturday?.trim() && `Sábados: ${company.hours.saturday.trim()}`,
    company?.hours?.sunday?.trim() && `Domingos: ${company.hours.sunday.trim()}`,
  ].filter(Boolean) as string[]
  const hasContact = Boolean(phone || whatsapp || email || address || hours.length)

  return (
    <footer id="contacto" className="scroll-mt-24 bg-[#F5EFEB] dark:bg-[#1C1816] text-[#1A1A1A] dark:text-[#F7F3EE] border-t border-[#736B63]/15 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
          <div className="space-y-4">
            <p className="font-editorial text-3xl font-bold tracking-tight">{storeName}</p>
            {about && <p className="text-sm text-[#736B63] dark:text-[#A89F95] leading-relaxed">{about}</p>}
            {socials.length > 0 && (
              <ul className="pt-2 flex items-center gap-3">
                {socials.map((social) => {
                  const Icon = SOCIAL_ICONS[social.platform]
                  return (
                    <li key={social.platform}>
                      <a
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-full bg-white dark:bg-[#2A2421] border border-[#736B63]/15 flex items-center justify-center hover:bg-[#E06B3A] hover:text-white hover:border-[#E06B3A] transition-all shadow-sm"
                        aria-label={`${social.label} de ${storeName}`}
                      >
                        <Icon className="w-4 h-4" aria-hidden />
                      </a>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {categories.length > 0 && (
            <nav aria-label="Categorías" className="space-y-4">
              <h2 className="font-editorial text-lg font-bold">Categorías</h2>
              <ul className="space-y-1 text-sm text-[#5F5750] dark:text-[#A89F95]">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link href={category.href} className="group flex items-center justify-between py-1.5 hover:text-[#C2531F] dark:hover:text-[#F07C48] transition-colors">
                      <span>{category.name}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href={`${prefix}/ofertas`} className="inline-block py-1.5 font-semibold text-[#C2531F] dark:text-[#F07C48] hover:underline">
                    Ver ofertas
                  </Link>
                </li>
              </ul>
            </nav>
          )}

          {hasContact && (
            <div className="space-y-4">
              <h2 className="font-editorial text-lg font-bold">Contacto</h2>
              <ul className="space-y-3 text-sm text-[#5F5750] dark:text-[#A89F95]">
                {phone && (
                  <li>
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center gap-2.5 hover:text-[#C2531F] dark:hover:text-[#F07C48]">
                      <Phone className="w-4 h-4 text-[#C2531F] dark:text-[#F07C48] shrink-0" aria-hidden />
                      <span>{phone}</span>
                    </a>
                  </li>
                )}
                {whatsapp && (
                  <li>
                    <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:text-[#C2531F] dark:hover:text-[#F07C48]">
                      <MessageCircle className="w-4 h-4 text-[#C2531F] dark:text-[#F07C48] shrink-0" aria-hidden />
                      <span>WhatsApp</span>
                    </a>
                  </li>
                )}
                {email && (
                  <li>
                    <a href={`mailto:${email}`} className="flex items-center gap-2.5 break-all hover:text-[#C2531F] dark:hover:text-[#F07C48]">
                      <Mail className="w-4 h-4 text-[#C2531F] dark:text-[#F07C48] shrink-0" aria-hidden />
                      <span>{email}</span>
                    </a>
                  </li>
                )}
                {address && (
                  <li className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[#C2531F] dark:text-[#F07C48] shrink-0 mt-0.5" aria-hidden />
                    <span>{address}</span>
                  </li>
                )}
                {hours.length > 0 && (
                  <li className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-[#C2531F] dark:text-[#F07C48] shrink-0 mt-0.5" aria-hidden />
                    <span className="space-y-0.5">
                      {hours.map((line) => <span key={line} className="block">{line}</span>)}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-14 pt-8 border-t border-[#736B63]/15 flex flex-col items-center gap-4 text-xs text-[#5F5750] dark:text-[#A89F95] sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {storeName}</p>
          <LegalFooterLinks className="[&_ul]:justify-center [&_ul]:text-xs" />
          <p>
            Tienda creada con <Link href="/" className="font-semibold text-[#1A1A1A] dark:text-[#F7F3EE] hover:underline">MiTiendaPy</Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
