'use client'

import React from 'react'
import Link from 'next/link'
import { MapPin, Phone, Mail, Instagram, Facebook, Clock, ShieldCheck, Heart, ArrowUpRight } from 'lucide-react'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import type { WebsiteSettings } from '@/types/website-settings'

interface ModaFemeninaFooterProps {
  settings: WebsiteSettings
}

export function ModaFemeninaFooter({ settings }: ModaFemeninaFooterProps) {
  const company = useStorefrontCompanyInfo(settings.company_info)
  const brandName = company.name?.trim() || 'Modeza.'
  const displayName = brandName.endsWith('.') ? brandName : `${brandName}.`

  return (
    <footer className="bg-[#F5EFEB] dark:bg-[#1C1816] text-[#1A1A1A] dark:text-[#F7F3EE] border-t border-[#736B63]/15 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Columna 1: Identidad */}
          <div className="space-y-4">
            <h3 className="font-editorial text-3xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F7F3EE]">
              {displayName}
            </h3>
            <p className="text-sm text-[#736B63] dark:text-[#A89F95] leading-relaxed">
              Diseños minimalistas de impacto máximo. Redefiní tu estilo con prendas atemporales y sofisticación en cada detalle.
            </p>
            <div className="pt-2 flex items-center gap-3">
              {company.instagram && (
                <a
                  href={company.instagram.startsWith('http') ? company.instagram : `https://instagram.com/${company.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white dark:bg-[#2A2421] border border-[#736B63]/15 flex items-center justify-center text-[#1A1A1A] dark:text-[#F7F3EE] hover:bg-[#E06B3A] hover:text-white hover:border-[#E06B3A] transition-all shadow-sm"
                  aria-label="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {company.facebook && (
                <a
                  href={company.facebook.startsWith('http') ? company.facebook : `https://facebook.com/${company.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white dark:bg-[#2A2421] border border-[#736B63]/15 flex items-center justify-center text-[#1A1A1A] dark:text-[#F7F3EE] hover:bg-[#E06B3A] hover:text-white hover:border-[#E06B3A] transition-all shadow-sm"
                  aria-label="Facebook"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Columna 2: Colecciones */}
          <div className="space-y-4">
            <h4 className="font-editorial text-lg font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">
              Colecciones
            </h4>
            <ul className="space-y-2.5 text-sm text-[#736B63] dark:text-[#A89F95]">
              <li>
                <Link href="/productos?category=Vestidos" className="hover:text-[#E06B3A] transition-colors flex items-center justify-between group">
                  <span>Vestidos & Monos</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link href="/productos?category=Tops" className="hover:text-[#E06B3A] transition-colors flex items-center justify-between group">
                  <span>Blusas & Camisas</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link href="/productos?category=Outerwear" className="hover:text-[#E06B3A] transition-colors flex items-center justify-between group">
                  <span>Blazers & Abrigos</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link href="/productos?category=Bottoms" className="hover:text-[#E06B3A] transition-colors flex items-center justify-between group">
                  <span>Pantalones & Jeans</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link href="/ofertas" className="text-[#E06B3A] font-semibold hover:underline flex items-center gap-1">
                  <span>Liquidación hasta 50% OFF</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Información y Tienda */}
          <div className="space-y-4">
            <h4 className="font-editorial text-lg font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">
              Atención al Cliente
            </h4>
            <ul className="space-y-2.5 text-sm text-[#736B63] dark:text-[#A89F95]">
              {company.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-[#E06B3A] shrink-0" />
                  <span>{company.phone}</span>
                </li>
              )}
              {company.whatsapp && (
                <li className="flex items-center gap-2.5">
                  <span className="w-4 h-4 text-[#E06B3A] shrink-0 font-bold">WA</span>
                  <span>WhatsApp: {company.whatsapp}</span>
                </li>
              )}
              {company.address && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#E06B3A] shrink-0 mt-0.5" />
                  <span>{company.address}</span>
                </li>
              )}
              <li className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#E06B3A] shrink-0" />
                <span>Lun a Sáb: 09:00 - 19:00</span>
              </li>
            </ul>
          </div>

          {/* Columna 4: Club & Newsletter */}
          <div className="space-y-4">
            <h4 className="font-editorial text-lg font-bold text-[#1A1A1A] dark:text-[#F7F3EE]">
              Modeza Club
            </h4>
            <p className="text-sm text-[#736B63] dark:text-[#A89F95]">
              Suscribite para recibir lanzamientos exclusivos, adelantos de temporada y 10% OFF en tu primera compra.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="Tu correo electrónico..."
                className="w-full px-4 py-2.5 rounded-full border border-[#736B63]/25 bg-white dark:bg-[#2A2421] text-xs focus:outline-none focus:border-[#E06B3A]"
              />
              <button
                type="button"
                className="px-4 py-2.5 rounded-full bg-[#1A1A1A] text-white text-xs font-semibold hover:bg-[#E06B3A] transition-colors shrink-0"
              >
                Unirme
              </button>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-[#736B63] dark:text-[#A89F95]">
              <ShieldCheck className="w-4 h-4 text-[#E06B3A]" />
              <span>Compra 100% segura y protegida</span>
            </div>
          </div>
        </div>

        {/* Separador inferior */}
        <div className="mt-16 pt-8 border-t border-[#736B63]/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#736B63] dark:text-[#A89F95]">
          <p>© {new Date().getFullYear()} {company.name || 'Modeza'}. Todos los derechos reservados.</p>
          <p className="flex items-center gap-1">
            <span>Potenciado con elegancia por</span>
            <span className="font-semibold text-[#1A1A1A] dark:text-[#F7F3EE]">MiTienda.py</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
