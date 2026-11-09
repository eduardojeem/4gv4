import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExtraBrandColorSwatches } from '@/components/admin/website/ExtraBrandColorSwatches'
import { EXTRA_BRAND_COLORS, findExtraBrandColor } from '@/lib/website/brand-colors'
import { isValidBrandHexColor } from '@/lib/website/brand-color'

function contrastWithWhite(hex: string) {
  const channels = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  return 1.05 / (luminance + 0.05)
}

describe('tonos extra de marca', () => {
  it('son HEX válidos, únicos y legibles con texto blanco', () => {
    expect(EXTRA_BRAND_COLORS.length).toBeGreaterThanOrEqual(16)
    expect(new Set(EXTRA_BRAND_COLORS.map((color) => color.hex)).size).toBe(EXTRA_BRAND_COLORS.length)
    for (const color of EXTRA_BRAND_COLORS) {
      expect(isValidBrandHexColor(color.hex)).toBe(true)
      expect(contrastWithWhite(color.hex)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('reconoce un tono sin importar mayúsculas', () => {
    expect(findExtraBrandColor('#8b1e3f')?.name).toBe('Bordó')
    expect(findExtraBrandColor('#123456')).toBeNull()
    expect(findExtraBrandColor(undefined)).toBeNull()
  })

  it('elegir un tono lo devuelve como HEX y marca el seleccionado', () => {
    const onSelect = vi.fn()
    render(<ExtraBrandColorSwatches brandColor="custom" customBrandColor="#166534" onSelect={onSelect} />)

    expect(screen.getByRole('button', { name: 'Usar color Verde bosque' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Usar color Vino' }))
    expect(onSelect).toHaveBeenCalledWith('#6B1D2F')
  })

  it('con un color de la paleta principal no marca ningún tono extra', () => {
    render(<ExtraBrandColorSwatches brandColor="blue" customBrandColor="#166534" onSelect={vi.fn()} />)
    expect(screen.getAllByRole('button').every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true)
  })
})
