import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  STOREFRONT_STYLE_OPTIONS,
  STOREFRONT_TEMPLATES_METADATA,
  resolveStorefrontStyle,
  suggestStorefrontAppearance,
} from '@/lib/website/storefront-style'
import { CompanyInfoSchema } from '@/lib/validation/website-settings'
import { pickRoutineProducts } from '@/components/public/inicio/BeautyRoutine'
import { StorefrontTemplateSelector } from '@/components/admin/website/StorefrontTemplateSelector'
import type { PublicProduct } from '@/types/public'

const product = (id: string, category: string, extra: Partial<PublicProduct> = {}) => ({
  id, name: `Producto ${id}`, sale_price: 100000, in_stock: true, image: `/fotos/${id}.webp`,
  category: { id: category, name: category }, ...extra,
}) as unknown as PublicProduct

describe('plantilla Belleza', () => {
  it('se puede elegir y guardar', () => {
    expect(STOREFRONT_STYLE_OPTIONS.map((option) => option.value)).toContain('beauty')
    expect(resolveStorefrontStyle('beauty', 'general')).toBe('beauty')
    expect(STOREFRONT_TEMPLATES_METADATA.beauty.recommendedVerticals).toContain('Cosmética')
    expect(CompanyInfoSchema.shape.storefrontStyle.safeParse('beauty').success).toBe(true)
  })

  it('el asistente se la sugiere a cosmética y a quien vende perfumes o maquillaje', () => {
    expect(suggestStorefrontAppearance({ businessVertical: 'cosmetics' })).toMatchObject({ style: 'beauty', brandColor: 'rose', headerStyle: 'solid' })
    expect(suggestStorefrontAppearance({ businessVertical: 'general', name: 'Perfumería Aroma' }).style).toBe('beauty')
    expect(suggestStorefrontAppearance({ businessVertical: 'other', description: 'Maquillaje y skincare' }).style).toBe('beauty')
  })

  it('una peluquería o un spa siguen yendo a Servicios', () => {
    expect(suggestStorefrontAppearance({ businessVertical: 'general', name: 'Salón de belleza Ana' }).style).toBe('services')
  })

  it('«Automático» no cambia el aspecto de las tiendas de cosmética que ya existen', () => {
    expect(resolveStorefrontStyle('auto', 'cosmetics')).toBe('classic')
  })

  it('aparece en el selector de plantillas', () => {
    render(<StorefrontTemplateSelector value="auto" onChange={vi.fn()} businessVertical="cosmetics" servicesAvailable={false} />)
    expect(screen.getByRole('button', { name: /^Belleza/ })).toBeInTheDocument()
  })
})

describe('la rutina de la portada', () => {
  it('toma un producto por categoría, priorizando ofertas y destacados', () => {
    const routine = pickRoutineProducts([
      product('a', 'Rostro'),
      product('b', 'Rostro', { has_offer: true, offer_price: 80000 }),
      product('c', 'Cabello', { featured: true }),
      product('d', 'Maquillaje'),
      product('e', 'Fragancias'),
      product('f', 'Uñas'),
    ])
    // Rostro: gana la oferta (b) sobre a. Después destacados (c) y el resto en orden.
    expect(routine.map((item) => item.id)).toEqual(['b', 'c', 'd', 'e'])
    expect(new Set(routine.map((item) => item.category?.id)).size).toBe(routine.length)
  })

  it('deja afuera lo agotado o sin foto', () => {
    const routine = pickRoutineProducts([
      product('a', 'Rostro', { in_stock: false }),
      product('b', 'Cabello', { image: null }),
      product('c', 'Maquillaje'),
      product('d', 'Fragancias'),
    ])
    expect(routine.map((item) => item.id)).toEqual(['c', 'd'])
  })

  it('sin dos categorías distintas no hay rutina', () => {
    expect(pickRoutineProducts([product('a', 'Rostro'), product('b', 'Rostro')])).toEqual([])
  })
})

describe('header de Belleza', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/public/PublicHeader.tsx'), 'utf8')

  it('suma una barra con las categorías que tienen productos', () => {
    expect(source).toContain("const isBeauty = storefrontStyle === 'beauty'")
    expect(source).toMatch(/!category\.parent_id && \(category\.productCount \?\? 0\) > 0/)
    expect(source).toContain('aria-label="Categorías"')
    expect(source).toContain('?category_id=')
  })

  it('respeta el header de color que eligió el dueño y no hace titilar las ofertas', () => {
    expect(source).toContain("companyInfo?.headerStyle !== 'accent' && companyInfo?.headerStyle !== 'dark'")
    expect(source).toContain("isOffer && !isBeauty && 'animate-pulse'")
  })
})
