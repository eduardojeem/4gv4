import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { RafflesManager } from '@/components/dashboard/loyalty/RafflesManager'

/**
 * El alta de un sorteo eran siete bloques numerados, cada uno de un color, con
 * catorce campos y dos «simuladores en vivo» antes de los premios. Y dos de
 * esos bloques venían prendidos diciendo cosas que no pasaban:
 *
 * - «Participación Directa por Compra: cada Gs. 100.000 = +1 número». En
 *   realidad `tryAutoRaffleEntryForSale` le gasta los puntos al cliente al
 *   cerrar la venta, hasta cinco números, sin preguntarle.
 * - «Compra de puntos en caja», prendido: el cliente paga y recibe puntos, o
 *   sea que se le venden números de sorteo por plata.
 */

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const montar = () => {
  const onCreate = vi.fn(async () => true)
  render(
    <RafflesManager
      raffles={[]}
      onCreate={onCreate}
      onUpdateStatus={vi.fn(async () => true)}
      onDraw={vi.fn(async () => undefined)}
      onRefresh={vi.fn()}
      canManage
    />,
  )
  return { onCreate }
}

const abrirAlta = async () => {
  await userEvent.click(screen.getByRole('button', { name: /Nuevo sorteo/i }))
  return screen.getByRole('dialog')
}

describe('crear un sorteo', () => {
  it('pregunta lo mínimo: nombre, premio, hasta cuándo y cuántos puntos', async () => {
    montar()
    const dialogo = await abrirAlta()

    expect(within(dialogo).getByLabelText(/¿Cómo se llama el sorteo\?/)).toBeInTheDocument()
    expect(within(dialogo).getByText('¿Qué se sortea?')).toBeInTheDocument()
    expect(within(dialogo).getByLabelText(/¿Hasta cuándo se participa\?/)).toBeInTheDocument()
    expect(within(dialogo).getByLabelText(/¿Cuántos puntos cuesta un número\?/)).toBeInTheDocument()
  })

  it('el costo en puntos se dice en palabras mientras se escribe', async () => {
    montar()
    const dialogo = await abrirAlta()

    expect(within(dialogo).getByText('50 puntos = 1 ticket de sorteo')).toBeInTheDocument()
  })

  it('todo lo demás queda plegado, no en la cara', async () => {
    montar()
    const dialogo = await abrirAlta()

    const avanzadas = within(dialogo).getByText('Opciones avanzadas').closest('details')
    expect(avanzadas).not.toHaveAttribute('open')
    expect(avanzadas).toContainElement(within(dialogo).getByLabelText(/Edad mínima/))
    expect(avanzadas).toContainElement(within(dialogo).getByLabelText(/Máximo de números por cliente/))
    expect(avanzadas).toContainElement(within(dialogo).getByLabelText(/Desde cuándo/))
  })

  /** Gastar el saldo de un cliente sin que lo pida no puede venir puesto. */
  it('el canje automático viene apagado y dice lo que de verdad hace', async () => {
    montar()
    const dialogo = await abrirAlta()

    const canjeAuto = within(dialogo).getByLabelText(/Canjear los puntos solo, al cobrar/)
    expect(canjeAuto).not.toBeChecked()
    expect(within(dialogo).getByText(/le canjea al cliente\s+los puntos que tenga por números \(hasta 5\)/)).toBeInTheDocument()
  })

  it('vender puntos por plata viene apagado y se llama por su nombre', async () => {
    montar()
    const dialogo = await abrirAlta()

    const ventaDePuntos = within(dialogo).getByLabelText(/Vender puntos en caja/)
    expect(ventaDePuntos).not.toBeChecked()
    expect(within(dialogo).getByText(/le\s+vendés números del sorteo/)).toBeInTheDocument()
  })

  it('el precio del punto solo aparece si se prende la venta', async () => {
    montar()
    const dialogo = await abrirAlta()

    expect(within(dialogo).queryByLabelText(/Precio de cada punto/)).not.toBeInTheDocument()

    await userEvent.click(within(dialogo).getByLabelText(/Vender puntos en caja/))

    expect(within(dialogo).getByLabelText(/Precio de cada punto/)).toBeInTheDocument()
    // Y dice cuánto le sale un número al cliente, que es lo que se cobra.
    expect(within(dialogo).getByText(/Un número le sale/)).toBeInTheDocument()
  })

  it('las plantillas dejan el sorteo armado sin prender esas dos opciones', async () => {
    montar()
    const dialogo = await abrirAlta()

    await userEvent.click(within(dialogo).getByText('Gran Sorteo Aniversario'))

    expect(within(dialogo).getByLabelText(/¿Cómo se llama el sorteo\?/)).toHaveValue(
      'Gran Sorteo Aniversario de la Tienda',
    )
    expect(within(dialogo).getByLabelText(/Canjear los puntos solo, al cobrar/)).not.toBeChecked()
    expect(within(dialogo).getByLabelText(/Vender puntos en caja/)).not.toBeChecked()
  })

  it('ya no hay bloques numerados ni simuladores', async () => {
    montar()
    const dialogo = await abrirAlta()

    expect(within(dialogo).queryByText(/Simulación en Vivo/i)).not.toBeInTheDocument()
    expect(within(dialogo).queryByText(/Participación Directa por Compra/i)).not.toBeInTheDocument()
    expect(within(dialogo).queryByText(/Generación Escalonada/i)).not.toBeInTheDocument()
  })
})

/**
 * Con el sorteo cerrado y nadie canjeado, la pantalla ofrecía «Sortear Ahora»,
 * pedía confirmar que la acción era definitiva, y recién la base contestaba
 * «El sorteo no tiene participantes» con un 400. El botón no tiene que estar
 * disponible si no hay a quién sortear.
 */
describe('sortear sin participantes', () => {
  const sorteo = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    name: 'Sorteo de prueba',
    status: 'closed',
    points_per_ticket: 1,
    prizes: [{ position: 1, title: 'Un premio' }],
    starts_at: new Date(Date.now() - 86400000).toISOString(),
    ends_at: new Date(Date.now() - 3600000).toISOString(),
    max_tickets_total: 200,
    tickets: [{ count: 0 }],
    ...over,
  })

  const montarCon = (raffles: unknown[]) => {
    render(
      <RafflesManager
        raffles={raffles as never}
        onCreate={vi.fn(async () => true)}
        onUpdateStatus={vi.fn(async () => true)}
        onDraw={vi.fn(async () => undefined)}
        onRefresh={vi.fn()}
        canManage
      />,
    )
  }

  it('no deja sortear si nadie canjeó, y lo dice', () => {
    montarCon([sorteo()])

    expect(screen.getByRole('button', { name: /Sortear Ahora/i })).toBeDisabled()
    expect(screen.getByText(/Nadie canjeó números/)).toBeInTheDocument()
  })

  it('con números canjeados sí deja', () => {
    montarCon([sorteo({ tickets: [{ count: 3 }] })])

    expect(screen.getByRole('button', { name: /Sortear Ahora/i })).toBeEnabled()
    expect(screen.queryByText(/Nadie canjeó números/)).not.toBeInTheDocument()
  })
})

/**
 * «Cerrar venta» se hacía de un clic y sin preguntar nada, y no tiene vuelta
 * atrás: un sorteo cerrado no se puede volver a publicar y ya nadie canjea.
 * Dos sorteos de prueba murieron así antes de que nadie participara.
 */
describe('cerrar un sorteo', () => {
  const abierto = (tickets = 0) => ({
    id: 'r2',
    name: 'Sorteo abierto',
    status: 'published',
    points_per_ticket: 1,
    prizes: [{ position: 1, title: 'Un premio' }],
    starts_at: new Date(Date.now() - 86400000).toISOString(),
    ends_at: new Date(Date.now() + 86400000).toISOString(),
    max_tickets_total: 200,
    tickets: [{ count: tickets }],
  })

  const montarAbierto = (tickets = 0) => {
    const onUpdateStatus = vi.fn(async () => true)
    render(
      <RafflesManager
        raffles={[abierto(tickets)] as never}
        onCreate={vi.fn(async () => true)}
        onUpdateStatus={onUpdateStatus}
        onDraw={vi.fn(async () => undefined)}
        onRefresh={vi.fn()}
        canManage
      />,
    )
    return { onUpdateStatus }
  }

  it('pregunta antes, y avisa que no se puede volver atrás', async () => {
    const { onUpdateStatus } = montarAbierto()

    await userEvent.click(screen.getByRole('button', { name: /Cerrar venta/i }))

    expect(onUpdateStatus).not.toHaveBeenCalled()
    expect(screen.getByText(/no se puede volver a abrir/)).toBeInTheDocument()
    expect(screen.getByText(/Todavía no canjeó nadie/)).toBeInTheDocument()
  })

  it('recién cierra cuando se confirma', async () => {
    const { onUpdateStatus } = montarAbierto()

    await userEvent.click(screen.getByRole('button', { name: /Cerrar venta/i }))
    await userEvent.click(screen.getByRole('button', { name: /Cerrar el sorteo/i }))

    expect(onUpdateStatus).toHaveBeenCalledWith('r2', 'closed')
  })

  it('si ya hay números canjeados no mete el aviso extra', async () => {
    montarAbierto(4)

    await userEvent.click(screen.getByRole('button', { name: /Cerrar venta/i }))

    expect(screen.getByText(/no se puede volver a abrir/)).toBeInTheDocument()
    expect(screen.queryByText(/Todavía no canjeó nadie/)).not.toBeInTheDocument()
  })
})

describe('lo que queda guardado', () => {
  const manager = leer('src/components/dashboard/loyalty/RafflesManager.tsx')

  it('un sorteo nuevo arranca sin canje automático ni venta de puntos', () => {
    const defaults = manager.slice(manager.indexOf('const EMPTY_RAFFLE'), manager.indexOf('function ticketCount'))
    expect(defaults).toContain('auto_entry_on_sale: false')
    expect(defaults).toContain('allow_point_purchase: false')
  })

  it('ninguna plantilla las prende', () => {
    const plantillas = manager.slice(manager.indexOf('RAFFLE_TEMPLATES'), manager.indexOf('function formatDateTimeLocal'))
    expect(plantillas).not.toContain('auto_entry_on_sale: true')
    expect(plantillas).not.toContain('allow_point_purchase: true')
  })

  /** El texto de la pantalla tiene que coincidir con lo que hace el código. */
  it('lo que dice la pantalla es lo que hace el canje automático', () => {
    const autoEntry = leer('src/lib/raffles/auto-entry.ts')
    expect(autoEntry).toContain('redeem_raffle_tickets')
    expect(autoEntry).toContain('Math.min(affordableTickets, 5)')
  })
})
