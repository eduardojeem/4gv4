/**
 * Guía de Puntos y Sorteos.
 *
 * Es la única documentación que ve el usuario dentro del producto, y la
 * mecánica tiene varias reglas que no se deducen mirando la pantalla (que los
 * puntos no se acreditan sin cliente asignado, que el sorteo no se puede
 * repetir, que la autoexclusión gana sobre el saldo). Si la guía no las dice,
 * nadie las descubre hasta que hay un reclamo.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { LOYALTY_GUIDE } from '@/components/dashboard/common/section-guides-data'
import { SectionGuideModal } from '@/components/dashboard/common/SectionGuideModal'

beforeAll(() => {
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  })
})

describe('LOYALTY_GUIDE — contenido', () => {
  const text = JSON.stringify(LOYALTY_GUIDE).toLowerCase()

  it('explica la tasa de conversión con un número concreto', () => {
    expect(text).toContain('10.000')
    expect(text).toContain('15 puntos')
  })

  it('aclara que la acreditación es automática y no se duplica', () => {
    expect(text).toContain('acredita')
    expect(text).toContain('dos veces')
  })

  it('dice que con varias promociones vigentes se aplica una sola', () => {
    expect(text).toContain('una sola')
  })

  it('explica la equidad del sorteo: números al azar y sin repetir', () => {
    expect(text).toContain('al azar')
    expect(text).toContain('sin repetir')
  })

  it('deja claro que el sorteo se corre una única vez y es verificable', () => {
    expect(text).toContain('no se puede repetir')
    expect(text).toContain('semilla')
  })

  it('cubre juego responsable: autoexclusión y que participar no garantiza premio', () => {
    expect(text).toContain('autoexclusión')
    expect(text).toContain('bloqueado es participar')
  })

  it('dice que los saldos no se pueden tocar a mano y que el historial es inmutable', () => {
    expect(text).toContain('no aceptan escritura directa')
    expect(text).toContain('inmutable')
  })

  it('cierra con el tip del reclamo más probable: "compré y no veo los puntos"', () => {
    expect(LOYALTY_GUIDE.tip?.toLowerCase()).toContain('no ve los puntos')
    // Las tres causas reales, en orden de frecuencia.
    expect(LOYALTY_GUIDE.tip?.toLowerCase()).toContain('cliente asignado')
  })
})

describe('LOYALTY_GUIDE — ejemplos', () => {
  it('trae un ejemplo por cada cosa que el usuario va a querer hacer', () => {
    expect(LOYALTY_GUIDE.examples?.length).toBeGreaterThanOrEqual(5)
  })

  it('cada ejemplo dice el objetivo, los pasos y el resultado', () => {
    for (const example of LOYALTY_GUIDE.examples ?? []) {
      expect(example.goal.length).toBeGreaterThan(20)
      expect(example.setup.length).toBeGreaterThanOrEqual(2)
      expect(example.result.length).toBeGreaterThan(30)
    }
  })

  it('cubre configurar, promocionar, sortear, auditar y autoexcluir', () => {
    const goals = (LOYALTY_GUIDE.examples ?? []).map((e) => e.goal.toLowerCase()).join(' | ')

    expect(goals).toContain('punto')
    expect(goals).toContain('doble puntos')
    expect(goals).toContain('sortear')
    expect(goals).toContain('faltan puntos')
    expect(goals).toContain('participar')
  })
})

describe('SectionGuideModal con la guía de puntos', () => {
  it('renderiza los ocho pasos', () => {
    render(<SectionGuideModal open onOpenChange={() => {}} guide={LOYALTY_GUIDE} />)

    for (const step of LOYALTY_GUIDE.steps) {
      expect(screen.getByText(step.title)).toBeInTheDocument()
    }
  })

  it('muestra los ejemplos en su pestaña', async () => {
    render(<SectionGuideModal open onOpenChange={() => {}} guide={LOYALTY_GUIDE} />)

    await userEvent.click(screen.getByRole('tab', { name: /Ejemplos/ }))

    const first = LOYALTY_GUIDE.examples![0]
    expect(screen.getByText(new RegExp(first.goal.slice(0, 25)))).toBeInTheDocument()
    expect(screen.getByText(first.result)).toBeInTheDocument()
  })
})
