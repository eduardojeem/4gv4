import { describe, expect, it } from 'vitest'
import { BRAND_PALETTES, brandPaletteStyle, colorContrast, isBrandPalette, paletteFromPixels, readableBrandAction, recommendedPalettes } from '@/lib/website/brand-palette'
import { STOREFRONT_STYLE_PREFERENCES } from '@/lib/website/storefront-style'
import { CompanyInfoSchema } from '@/lib/validation/website-settings'
import { parseStorefrontPreviewDraft, STOREFRONT_PREVIEW_UPDATE } from '@/lib/website/storefront-preview-message'

describe('paletas de tienda', () => {
  it('ordena por rubro sin modificar la lista ni ocultar alternativas', () => {
    expect(recommendedPalettes('cosmetics')[0].id).toBe('fuchsia')
    expect(recommendedPalettes('electronics')[0].id).toBe('tech')
    expect(recommendedPalettes('unknown')).toHaveLength(BRAND_PALETTES.length)
    expect(recommendedPalettes('unknown')[0].id).toBe('minimal')
    expect(recommendedPalettes('barbershop')[0].id).toBe('barber')
  })
  it('garantiza texto y acciones legibles incluso con marcas blancas o amarillas', () => {
    for (const palette of BRAND_PALETTES) expect(colorContrast(palette.text, palette.background)).toBeGreaterThanOrEqual(4.5)
    for (const color of ['#fff', '#FFFF00', '#B21FB8', '#000000']) expect(colorContrast(readableBrandAction(color), '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
  })
  it('rechaza CSS arbitrario y paletas ilegibles', () => {
    expect(isBrandPalette({ ...BRAND_PALETTES[0], primary: 'url(https://bad)' })).toBe(false)
    expect(isBrandPalette({ ...BRAND_PALETTES[0], text: '#fff', background: '#fff' })).toBe(false)
    expect(brandPaletteStyle({ primary: '#fff' })).toBeUndefined()
  })
  it('sugiere desde píxeles y omite transparencias y fondos neutros', () => {
    expect(paletteFromPixels([255,255,255,255,0,0,0,0,180,24,180,255]).primary).toBe('#c018c0')
    expect(isBrandPalette(paletteFromPixels([]))).toBe(true)
  })
  it('conserva la combinación al validar y previsualizar cualquier plantilla', () => {
    const palette = { primary:'#B21FB8',accent:'#7457B8',background:'#FAFAFC',text:'#202633' }
    expect(CompanyInfoSchema.parse({ brandPalette: palette }).brandPalette).toEqual(palette)
    expect(parseStorefrontPreviewDraft({ type:STOREFRONT_PREVIEW_UPDATE,style:'especial-cosmeticos',brandColor:'custom',customBrandColor:palette.primary,brandPalette:palette,headerStyle:'solid',showTopBar:true })?.brandPalette).toEqual(palette)
  })
})


it('transporta la misma combinación al cambiar entre todas las plantillas registradas', () => {
  const brandPalette = {primary:'#B21FB8',accent:'#7457B8',background:'#FAFAFC',text:'#202633'}
  for (const style of STOREFRONT_STYLE_PREFERENCES.filter(value => value !== 'auto')) {
    expect(parseStorefrontPreviewDraft({type:STOREFRONT_PREVIEW_UPDATE,style,brandColor:'custom',customBrandColor:brandPalette.primary,brandPalette,headerStyle:'solid',showTopBar:true})?.brandPalette).toEqual(brandPalette)
  }
  expect(parseStorefrontPreviewDraft({type:STOREFRONT_PREVIEW_UPDATE,style:'classic',brandColor:'blue',brandPalette:{...brandPalette,accent:'url(javascript:1)'},headerStyle:'solid',showTopBar:true})).toBeNull()
})
