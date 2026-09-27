import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoyaltySettingsCard } from '@/components/dashboard/loyalty/LoyaltySettingsCard'
import {
  explainEarning,
  explainProgram,
  explainSpending,
  explainTicketCost,
} from '@/lib/loyalty/explain'

/**
 * Para usar puntos y sorteos hay que tener en la cabeza tres monedas
 * —guaraníes, puntos y tickets— y las conversiones entre ellas. Ninguna
 * pantalla decía la regla completa, así que el dueño del negocio no tenía
 * cómo contársela a un cliente.
 */

const AJUSTES = { enabled: true, currency_per_point: 10000, points_per_unit: 1 }
const SORTEO = { name: 'Aniversario', points_per_ticket: 50 }

/** `formatCurrency` separa «Gs.» del número con un espacio duro. */
const plano = (texto: string | null) => texto?.replace(/ /g, ' ') ?? null

describe('el programa dicho en una frase', () => {
  it('dice cómo se ganan los puntos', () => {
    expect(plano(explainEarning(AJUSTES))).toBe('Cada Gs. 10.000 de compra suma 1 punto')
  })

  it('acompaña el plural cuando el tramo da varios puntos', () => {
    expect(explainEarning({ ...AJUSTES, points_per_unit: 3 })).toContain('suma 3 puntos')
  })

  it('dice para qué sirven', () => {
    expect(explainSpending(SORTEO)).toBe('50 puntos = 1 ticket de «Aniversario»')
  })

  /** La pregunta del mostrador: cuánto hay que gastar para un ticket. */
  it('traduce los puntos a plata', () => {
    expect(plano(explainTicketCost(AJUSTES, SORTEO))).toBe('Un ticket sale Gs. 500.000 de compra')
  })

  it('redondea la compra necesaria para arriba, no para abajo', () => {
    // 45 puntos a 1 punto cada 10.000 son 450.000 exactos; 46 ya pasa al tramo.
    expect(plano(explainTicketCost(AJUSTES, { points_per_ticket: 46 }))).toBe('Un ticket sale Gs. 460.000 de compra')
  })

  it('con el programa apagado no dice nada', () => {
    expect(explainProgram({ ...AJUSTES, enabled: false }, SORTEO)).toEqual([])
  })

  it('sin sorteo dice lo que se puede decir, no inventa el resto', () => {
    expect(explainProgram(AJUSTES, null).map(plano)).toEqual(['Cada Gs. 10.000 de compra suma 1 punto'])
  })

  it('con datos incompletos no arma frases falsas', () => {
    expect(explainEarning({ ...AJUSTES, currency_per_point: 0 })).toBeNull()
    expect(explainSpending({ points_per_ticket: 0 })).toBeNull()
    expect(explainTicketCost(AJUSTES, null)).toBeNull()
  })
})

/**
 * La tarjeta pedía seis números al mismo nivel y un simulador de tres
 * columnas. Para arrancar sólo hace falta decidir una cosa.
 */
describe('la tarjeta de puntos por compra', () => {
  const montar = (over: Partial<React.ComponentProps<typeof LoyaltySettingsCard>> = {}) => {
    const onSave = vi.fn(async () => true)
    render(
      <LoyaltySettingsCard
        settings={{ ...AJUSTES, rounding: 'floor', max_points_per_customer_per_day: null, points_expiration_months: null } as never}
        onSave={onSave}
        canManage
        {...over}
      />,
    )
    return { onSave }
  }

  it('abre con una sola pregunta y la regla escrita al lado', () => {
    montar()
    expect(screen.getByLabelText(/¿Cada cuánto gasto das un punto\?/)).toHaveValue(10000)
    expect(screen.getByText('Cada Gs. 10.000 de compra suma 1 punto')).toBeInTheDocument()
  })

  it('muestra el resultado con plata de verdad', () => {
    montar()
    expect(screen.getByText(/Una compra de Gs. 150.000 suma/)).toBeInTheDocument()
    expect(screen.getByText('15 puntos')).toBeInTheDocument()
  })

  /** Cambiar la tasa tiene que verse en la frase, no en la próxima pantalla. */
  it('la regla se rearma mientras se escribe', async () => {
    montar()
    const campo = screen.getByLabelText(/¿Cada cuánto gasto das un punto\?/)

    await userEvent.clear(campo)
    await userEvent.type(campo, '5000')

    expect(screen.getByText('Cada Gs. 5.000 de compra suma 1 punto')).toBeInTheDocument()
    expect(screen.getByText('30 puntos')).toBeInTheDocument()
  })

  it('el resto queda guardado bajo «Ajustes finos»', () => {
    montar()
    expect(screen.getByText('Ajustes finos')).toBeInTheDocument()
    // Están en el DOM pero dentro del bloque plegado.
    const plegado = screen.getByText('Ajustes finos').closest('details')
    expect(plegado).not.toHaveAttribute('open')
    expect(plegado).toContainElement(screen.getByLabelText(/Los puntos vencen/))
    expect(plegado).toContainElement(screen.getByLabelText(/Tope de puntos por día/))
  })

  it('dice qué pasa mientras está apagado', () => {
    montar({ settings: { ...AJUSTES, enabled: false, rounding: 'floor' } as never })
    expect(screen.getByText(/ninguna venta suma puntos/)).toBeInTheDocument()
  })

  it('guarda lo que se configuró', async () => {
    const { onSave } = montar()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, currency_per_point: 10000 }))
  })

  it('sin permiso de gestionar, no se puede tocar ni guardar', () => {
    montar({ canManage: false })
    expect(screen.getByLabelText(/¿Cada cuánto gasto das un punto\?/)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  })
})

describe('el vocabulario de la sección', () => {
  const card = readFileSync(
    resolve(process.cwd(), 'src/components/dashboard/loyalty/LoyaltySettingsCard.tsx'),
    'utf8',
  )

  it('no habla de acreditación ni de sistemas', () => {
    expect(card).not.toContain('Acreditación')
    expect(card).not.toContain('Sistema Activo')
    expect(card).not.toContain('Simulador')
  })
})
