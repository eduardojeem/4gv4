import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  isStorefrontStyleAvailable,
  resolveStorefrontStyle,
  suggestStorefrontAppearance,
} from '@/lib/website/storefront-style'
import { StorefrontTemplateSelector } from '@/components/admin/website/StorefrontTemplateSelector'

describe('la plantilla Servicios necesita la agenda', () => {
  it('solo está disponible con el módulo Servicios', () => {
    expect(isStorefrontStyleAvailable('services', { servicesAvailable: true })).toBe(true)
    expect(isStorefrontStyleAvailable('services', { servicesAvailable: false })).toBe(false)
    expect(isStorefrontStyleAvailable('fashion', { servicesAvailable: false })).toBe(true)
    // Sin dato no se cambia nada.
    expect(isStorefrontStyleAvailable('services')).toBe(true)
  })

  it('una tienda de ropa que la eligió vuelve a la plantilla de su rubro', () => {
    expect(resolveStorefrontStyle('services', 'clothing', { servicesAvailable: false })).toBe('fashion')
    expect(resolveStorefrontStyle('services', 'electronics', { servicesAvailable: false })).toBe('modern')
  })

  it('una barbería sin agenda no queda con una portada vacía', () => {
    expect(resolveStorefrontStyle('auto', 'barbershop', { servicesAvailable: false })).toBe('modern')
    expect(resolveStorefrontStyle('auto', 'barbershop', { servicesAvailable: true })).toBe('services')
  })

  it('con agenda cualquier rubro puede usarla: estética, spa o lavadero', () => {
    expect(resolveStorefrontStyle('services', 'cosmetics', { servicesAvailable: true })).toBe('services')
  })

  it('el asistente no la sugiere sin agenda', () => {
    const suggestion = suggestStorefrontAppearance({ businessVertical: 'barbershop', servicesAvailable: false })
    expect(suggestion.style).toBe('modern')
    expect(suggestion.reason).toContain('agenda')
    expect(suggestStorefrontAppearance({ businessVertical: 'barbershop', servicesAvailable: true }).style).toBe('services')
  })
})

describe('el selector de plantillas', () => {
  it('no ofrece Servicios a una cuenta sin agenda', () => {
    render(<StorefrontTemplateSelector value="auto" onChange={vi.fn()} businessVertical="clothing" servicesAvailable={false} />)
    expect(screen.queryByRole('button', { name: /^Servicios/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Moda/ })).toBeInTheDocument()
  })

  it('sí la ofrece cuando la cuenta tiene agenda', () => {
    render(<StorefrontTemplateSelector value="auto" onChange={vi.fn()} businessVertical="cosmetics" servicesAvailable />)
    expect(screen.getByRole('button', { name: /^Servicios/ })).toBeInTheDocument()
  })
})
