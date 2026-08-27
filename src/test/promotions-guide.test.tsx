/**
 * Guía de la sección de Promociones.
 *
 * La guía es la única documentación que ve el usuario dentro del producto, así
 * que se verifica que cubra los tres modos de promoción y los dos carruseles,
 * y que el modal la renderice entera (tiene mas pasos que las otras guias).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { PROMOTIONS_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { SectionGuideModal } from '@/components/dashboard/common/SectionGuideModal'

beforeAll(() => {
  // Radix Tabs necesita estas APIs de puntero, que jsdom no implementa.
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  })
})

describe('PROMOTIONS_GUIDE', () => {
  it('explica los tres modos de disponibilidad pública', () => {
    const text = JSON.stringify(PROMOTIONS_GUIDE).toLowerCase()

    expect(text).toContain('pos')
    expect(text).toContain('cupón')
    expect(text).toContain('automática')
  })

  it('aclara lo que mas confunde: qué campos no aplican a las ofertas automáticas', () => {
    const text = JSON.stringify(PROMOTIONS_GUIDE).toLowerCase()

    // min_purchase / max_discount / usage_limit se pueden cargar pero la tienda
    // los ignora en las automaticas. Si la guia no lo dice, nadie lo descubre.
    expect(text).toContain('compra mínima')
    expect(text).toContain('límite de usos')
  })

  it('distingue los dos carruseles y dice que no comparten datos', () => {
    const text = JSON.stringify(PROMOTIONS_GUIDE).toLowerCase()

    expect(text).toContain('carrusel')
    expect(text).toContain('inicio')
    expect(text).toContain('por separado')
  })

  it('cierra con un tip accionable para el caso de "no aparece en la tienda"', () => {
    expect(PROMOTIONS_GUIDE.tip).toBeTruthy()
    expect(PROMOTIONS_GUIDE.tip?.toLowerCase()).toContain('no aparece')
  })
})

describe('ejemplos de PROMOTIONS_GUIDE', () => {
  it('trae ejemplos concretos, no solo la explicación abstracta', () => {
    expect(PROMOTIONS_GUIDE.examples?.length).toBeGreaterThanOrEqual(3)
  })

  it('cada ejemplo dice qué se quiere, cómo se configura y qué ve el cliente', () => {
    for (const example of PROMOTIONS_GUIDE.examples ?? []) {
      expect(example.goal.length).toBeGreaterThan(20)
      expect(example.setup.length).toBeGreaterThanOrEqual(2)
      expect(example.result.length).toBeGreaterThan(20)
    }
  })

  it('cubre un ejemplo de cada uno de los tres modos de disponibilidad', () => {
    const text = JSON.stringify(PROMOTIONS_GUIDE.examples).toLowerCase()

    expect(text).toContain('oferta automática')
    expect(text).toContain('cupón para carrito público')
    expect(text).toContain('solo uso interno')
  })
})

describe('SectionGuideModal con la guía de promociones', () => {
  it('renderiza todos los pasos, no solo los primeros', () => {
    render(<SectionGuideModal open onOpenChange={() => {}} guide={PROMOTIONS_GUIDE} />)

    expect(screen.getByText(PROMOTIONS_GUIDE.title)).toBeInTheDocument()
    for (const step of PROMOTIONS_GUIDE.steps) {
      expect(screen.getByText(step.title)).toBeInTheDocument()
    }
  })

  it('muestra el tip final', () => {
    render(<SectionGuideModal open onOpenChange={() => {}} guide={PROMOTIONS_GUIDE} />)

    expect(screen.getByText(PROMOTIONS_GUIDE.tip!)).toBeInTheDocument()
  })

  it('los ejemplos viven en su propia pestaña y se pueden abrir', async () => {
    render(<SectionGuideModal open onOpenChange={() => {}} guide={PROMOTIONS_GUIDE} />)

    const first = PROMOTIONS_GUIDE.examples![0]
    // Arrancan ocultos: la pestaña por defecto es el paso a paso.
    expect(screen.queryByText(new RegExp(first.goal.slice(0, 30)))).toBeNull()

    await userEvent.click(screen.getByRole('tab', { name: /Ejemplos/ }))

    expect(screen.getByText(new RegExp(first.goal.slice(0, 30)))).toBeInTheDocument()
    expect(screen.getByText(first.result)).toBeInTheDocument()
    expect(screen.getByText(first.setup[0])).toBeInTheDocument()
  })

  it('se cierra con la X de la cabecera, no solo con "Entendido"', async () => {
    // El boton del primitivo hereda el color del cuerpo y quedaba oscuro sobre
    // el degradado; se reemplazo por uno propio, que tiene que seguir cerrando.
    const onOpenChange = vi.fn()
    render(<SectionGuideModal open onOpenChange={onOpenChange} guide={PROMOTIONS_GUIDE} />)

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('deja una sola X: no quedaron dos botones de cerrar superpuestos', () => {
    render(<SectionGuideModal open onOpenChange={() => {}} guide={PROMOTIONS_GUIDE} />)

    expect(screen.getAllByRole('button', { name: /Cerrar|Close/i })).toHaveLength(1)
  })

  it('una guía sin ejemplos no muestra pestañas', () => {
    const { steps, ...rest } = PROMOTIONS_GUIDE
    render(<SectionGuideModal open onOpenChange={() => {}} guide={{ ...rest, steps, examples: undefined }} />)

    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByText(steps[0].title)).toBeInTheDocument()
  })
})
