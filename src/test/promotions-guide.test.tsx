/**
 * Guía de la sección de Promociones.
 *
 * La guía es la única documentación que ve el usuario dentro del producto, así
 * que se verifica que cubra los tres modos de promoción y los dos carruseles,
 * y que el modal la renderice entera (tiene mas pasos que las otras guias).
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PROMOTIONS_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { SectionGuideModal } from '@/components/dashboard/common/SectionGuideModal'

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
})
