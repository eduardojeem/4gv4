import { createElement, type ImgHTMLAttributes } from 'react'
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
})
