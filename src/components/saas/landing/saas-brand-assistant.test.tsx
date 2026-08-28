import { createElement, type ImgHTMLAttributes } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SaaSBrandAssistant } from './saas-brand-assistant'

vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement('img', props),
}))

describe('SaaSBrandAssistant', () => {
  it('presents the mascot as optional brand guidance, not as an interactive assistant', () => {
    render(<SaaSBrandAssistant />)

    expect(screen.getByRole('img', { name: 'Asistente de Mi Tienda' })).toBeInTheDocument()
    expect(screen.getByText('Tu negocio, paso a paso')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('uses the lightweight assistant artwork and disables motion when requested', () => {
    render(<SaaSBrandAssistant />)

    expect(screen.getByRole('img', { name: 'Asistente de Mi Tienda' }))
      .toHaveAttribute('src', '/branding/mascot/mi-tienda-assistant-2d.png')

    const stylesheet = readFileSync(
      join(process.cwd(), 'src/components/saas/landing/saas-brand-assistant.module.css'),
      'utf8',
    )
    expect(stylesheet).toMatch(/@keyframes mascot-float/)
    expect(stylesheet).toMatch(/prefers-reduced-motion:\s*reduce/)
    expect(stylesheet).toMatch(/animation:\s*none/)
  })

  it('supports contextual guidance copy for the plans page', () => {
    render(
      <SaaSBrandAssistant
        title="Te ayudo a comparar"
        description="Revisá los límites y funciones vigentes de cada plan."
      />,
    )

    expect(screen.getByText('Te ayudo a comparar')).toBeInTheDocument()
    expect(screen.getByText('Revisá los límites y funciones vigentes de cada plan.')).toBeInTheDocument()
  })
})
