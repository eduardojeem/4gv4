import React from 'react'

export interface BrandCatalogEntry {
  id: string
  name: string
  category: 'sports' | 'fashion' | 'tech' | 'general'
  svgLogo: React.ReactNode
}

export function NikeLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-auto fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.71 6.57c-2.45 2.1-7.79 5.86-12.75 8.79l-4.1-3.69c-.58-.52-1.48-.48-2.01.1-.53.58-.49 1.49.09 2.01l4.98 4.48c.32.29.74.44 1.17.42.44-.02.84-.21 1.13-.53 4.2-4.63 10.6-10.3 12.39-11.23.51-.27.42-.64-.9-.35z" />
    </svg>
  )
}

export function AdidasLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-auto fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.4 17.6h2.2L6.1 9.8c-.2-.4-.7-.6-1.1-.4l-1.9.9c-.4.2-.6.7-.4 1.1l4.7 6.2zm4.8 0h2.2l-5.1-10c-.2-.4-.7-.6-1.1-.4l-1.9.9c-.4.2-.6.7-.4 1.1l6.3 8.4zm4.8 0h2.2l-6.7-12.2c-.2-.4-.7-.6-1.1-.4l-1.9.9c-.4.2-.6.7-.4 1.1l7.9 10.6z" />
    </svg>
  )
}

export function PumaLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-auto fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.5 4.5c-.3-.2-.7-.3-1.1-.2-1.5.3-3.2 1.3-4.8 2.8l-1.8-1.5c-.4-.3-.9-.4-1.4-.2-.5.2-.8.6-.9 1.1L8.2 11c-.7.3-1.5.7-2.3 1.2L3.5 10c-.4-.3-.9-.4-1.4-.2-.5.2-.8.6-.9 1.1-.2 1.1.2 2.2 1.1 2.8l3.1 2.2c.4.3.9.4 1.4.3.5-.1.9-.4 1.2-.8l1.7-2.6c1.2-.6 2.5-1 3.9-1.2l1.9 2.7c.3.4.7.7 1.2.7h4.8c.8 0 1.5-.7 1.5-1.5v-3c0-2.4-1.4-4.6-3.6-5.5z" />
    </svg>
  )
}

export function UnderArmourLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-auto fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.7 2 6 4.7 6 8c0 1.8.8 3.5 2.1 4.6C6.4 13.8 5 16.2 5 19h2.5c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5H19c0-2.8-1.4-5.2-3.1-6.4 1.3-1.1 2.1-2.8 2.1-4.6 0-3.3-2.7-6-6-6zm0 2.5c2 0 3.5 1.5 3.5 3.5 0 1.6-1.1 3-2.6 3.4-.3.1-.6.1-.9.1s-.6 0-.9-.1C9.6 11 8.5 9.6 8.5 8c0-2 1.5-3.5 3.5-3.5z" />
    </svg>
  )
}

export function ReebokLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-auto fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 14.5L12 8.5l9.5 6-3 1.5-6.5-4-6.5 4z" />
      <path d="M4 17.5l8-5 8 5-1.5 1-6.5-4-6.5 4z" />
    </svg>
  )
}

export function NewBalanceLogo() {
  return (
    <div className="flex items-center font-black tracking-tighter text-base italic">
      <span className="text-primary font-black">N</span>
      <span className="font-extrabold -ml-0.5">B</span>
    </div>
  )
}

export function ZaraLogo() {
  return (
    <span className="font-serif font-black tracking-[0.25em] text-sm uppercase scale-y-110">
      ZARA
    </span>
  )
}

export function VansLogo() {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="font-black tracking-widest text-xs uppercase border-b-2 border-current pb-0.5">VANS</span>
      <span className="text-[7px] font-bold tracking-tighter uppercase mt-0.5 opacity-80">OFF THE WALL</span>
    </div>
  )
}

export const POPULAR_PRESET_BRANDS: BrandCatalogEntry[] = [
  { id: 'nike', name: 'Nike', category: 'sports', svgLogo: <NikeLogo /> },
  { id: 'adidas', name: 'Adidas', category: 'sports', svgLogo: <AdidasLogo /> },
  { id: 'puma', name: 'Puma', category: 'sports', svgLogo: <PumaLogo /> },
  { id: 'under-armour', name: 'Under Armour', category: 'sports', svgLogo: <UnderArmourLogo /> },
  { id: 'reebok', name: 'Reebok', category: 'sports', svgLogo: <ReebokLogo /> },
  { id: 'new-balance', name: 'New Balance', category: 'sports', svgLogo: <NewBalanceLogo /> },
  { id: 'zara', name: 'Zara', category: 'fashion', svgLogo: <ZaraLogo /> },
  { id: 'vans', name: 'Vans', category: 'fashion', svgLogo: <VansLogo /> },
]

export function getBrandLogoOrFallback(idOrName: string): React.ReactNode | null {
  const norm = idOrName.toLowerCase().trim().replace(/\s+/g, '-')
  const match = POPULAR_PRESET_BRANDS.find((b) => b.id === norm || b.name.toLowerCase() === idOrName.toLowerCase().trim())
  if (match) return match.svgLogo
  return null
}
