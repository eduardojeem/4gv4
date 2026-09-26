import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CashStatusBanner } from '@/components/dashboard/CashStatusBanner'
import { describeSessionOpening } from '@/lib/cash/session-age'

/**
 * Abrir la caja es el primer paso del día: con la caja cerrada, el checkout del
 * POS no deja confirmar ninguna venta. En el panel, sin embargo, eso era un
 * botón más entre seis apretados en la misma fila, cada uno de un color fuerte:
 * el que importaba gritaba igual que el resto.
 */

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const montar = (props: Partial<React.ComponentProps<typeof CashStatusBanner>> = {}) => {
  const onOpen = vi.fn()
  const onClose = vi.fn()
  render(<CashStatusBanner status="cerrada" onOpen={onOpen} onClose={onClose} {...props} />)
  return { onOpen, onClose }
}

describe('hace cuánto está abierta la caja', () => {
  const ahora = new Date('2026-09-20T18:00:00')

  it('abierta hoy: la hora', () => {
    const apertura = describeSessionOpening('2026-09-20T08:15:00', ahora)
    expect(apertura?.texto).toMatch(/^desde las 08:15/)
    expect(apertura?.deOtroDia).toBe(false)
  })

  it('abierta ayer: lo dice, porque el arqueo no se hizo', () => {
    const apertura = describeSessionOpening('2026-09-19T08:15:00', ahora)
    expect(apertura).toMatchObject({ texto: 'desde ayer', dias: 1, deOtroDia: true })
  })

  /** En la base hay una sesión abierta desde mayo. */
  it('abierta hace meses: la fecha y los días', () => {
    const apertura = describeSessionOpening('2026-05-17T17:29:00', ahora)
    expect(apertura?.texto).toContain('17 de mayo')
    expect(apertura?.dias).toBe(126)
    expect(apertura?.deOtroDia).toBe(true)
  })

  /** Cuenta días de calendario: anoche a las 23:50 fue ayer, no «hace 0». */
  it('cuenta días de calendario, no de 24 horas', () => {
    expect(describeSessionOpening('2026-09-19T23:50:00', ahora)?.dias).toBe(1)
  })

  it('sin fecha no inventa nada', () => {
    expect(describeSessionOpening(null)).toBeNull()
    expect(describeSessionOpening('no es una fecha')).toBeNull()
  })
})

describe('la caja cerrada', () => {
  it('dice qué pasa si no se abre, no solo que está cerrada', () => {
    montar()
    expect(screen.getByText('La caja está cerrada')).toBeInTheDocument()
    expect(screen.getByText(/no deja confirmar ninguna venta/)).toBeInTheDocument()
  })

  it('abrir es la acción, y es la única', async () => {
    const { onOpen } = montar()
    const botones = screen.getAllByRole('button')
    expect(botones).toHaveLength(1)

    await userEvent.click(botones[0])
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('con una operación en curso no se puede abrir dos veces', () => {
    montar({ busy: true })
    expect(screen.getByRole('button', { name: /Abriendo/i })).toBeDisabled()
  })
})

describe('la caja abierta', () => {
  it('pasa a informar: desde cuándo y cuánto debería haber', () => {
    montar({
      status: 'abierta',
      openedAt: new Date().toISOString(),
      expectedBalance: 1_250_000,
      movementsCount: 12,
    })

    expect(screen.getByText(/^Caja abierta desde las/)).toBeInTheDocument()
    expect(screen.getByText(/12 movimientos/)).toBeInTheDocument()
  })

  it('avisa cuando el turno viene de otro día', () => {
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    montar({ status: 'abierta', openedAt: ayer.toISOString() })

    expect(screen.getByText(/Quedó abierta de ayer/)).toBeInTheDocument()
  })

  it('cerrar está, pero sin gritar', async () => {
    const { onClose } = montar({ status: 'abierta', openedAt: new Date().toISOString() })
    await userEvent.click(screen.getByRole('button', { name: /Cerrar caja/i }))
    expect(onClose).toHaveBeenCalled()
  })
})

/** Sin esto, el panel abría siempre anunciando «caja cerrada» mientras cargaba. */
describe('mientras no se sabe', () => {
  it('no anuncia nada: pregunta primero', () => {
    montar({ status: 'verificando' })
    expect(screen.queryByText('La caja está cerrada')).not.toBeInTheDocument()
    expect(screen.getByText(/Viendo cómo está la caja/)).toBeInTheDocument()
  })
})

describe('el panel abre con la caja', () => {
  const page = leer('src/app/dashboard/page.tsx')

  it('el estado de la caja va antes que el resto', () => {
    expect(page.indexOf('<CashStatusBanner')).toBeGreaterThan(-1)
    expect(page.indexOf('<CashStatusBanner')).toBeLessThan(page.indexOf('<StoreSetupAlert'))
  })

  it('ya no hay un botón de caja compitiendo en el encabezado', () => {
    expect(page).not.toContain('Caja Abierta (Cerrar)')
    expect(page).not.toContain('from-rose-500 to-red-600')
  })

  it('espera la primera consulta antes de decir que está cerrada', () => {
    expect(page).toContain('cajaVerificada')
    expect(page).toContain("status={!cajaVerificada ? 'verificando'")
  })
})
