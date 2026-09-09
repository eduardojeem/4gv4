import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SubscriptionTable } from '@/components/superadmin/subscriptions/subscription-table'
import type { SuperAdminSubscription } from '@/components/superadmin/subscriptions/types'
import {
  getAttentionLevel,
  getRecommendation,
  isAttention,
} from '@/components/superadmin/subscriptions/utils'

const dias = (n: number) => new Date(Date.now() + n * 86400000).toISOString()

const base = {
  provider: 'manual',
  provider_subscription_id: null,
  provider_customer_id: null,
  trial_ends_at: null,
  cancel_at_period_end: false,
  owner_id: 'u1',
  owner_name: 'Marta Giménez',
  owner_email: 'marta@aurora.com.py',
  plan_details: { price_monthly: 350_000, currency: 'PYG' },
  members_count: 6,
  products_count: 240,
  sales_count: 1820,
  storefront_public: true,
} as const

const sub = (over: Partial<SuperAdminSubscription>): SuperAdminSubscription => ({
  ...base,
  id: 'sub-1',
  organization_id: 'org-00000001',
  organization_name: 'Tienda Aurora',
  organization_slug: 'tienda-aurora',
  plan: 'PRO',
  status: 'active',
  current_period_starts_at: dias(-20),
  current_period_ends_at: dias(10),
  ...over,
} as SuperAdminSubscription)

const pintar = (items: SuperAdminSubscription[], onOpenDetail = vi.fn()) => {
  render(<SubscriptionTable items={items} onOpenDetail={onOpenDetail} onCopyValue={vi.fn()} />)
  return onOpenDetail
}

/**
 * `isAttention` metia en la misma bolsa «renueva en tres dias» y «venció hace
 * dos años»: las dos pintaban la fila del mismo ámbar, así que la pestaña
 * «Atención» no distinguía lo que hay que hacer hoy de lo que arrastra meses.
 */
describe('la severidad separa lo que ya pasó de lo que va a pasar', () => {
  it('sin cobrar o con el período vencido es urgente', () => {
    expect(getAttentionLevel(sub({ status: 'past_due' }))).toBe('urgent')
    expect(getAttentionLevel(sub({ status: 'unpaid' }))).toBe('urgent')
    expect(getAttentionLevel(sub({ current_period_ends_at: dias(-1) }))).toBe('urgent')
    expect(getAttentionLevel(sub({ current_period_ends_at: dias(-800) }))).toBe('urgent')
  })

  it('lo que vence pronto o se cancela es vigilancia, no urgencia', () => {
    expect(getAttentionLevel(sub({ current_period_ends_at: dias(3) }))).toBe('watch')
    expect(getAttentionLevel(sub({ cancel_at_period_end: true }))).toBe('watch')
    expect(getAttentionLevel(sub({ status: 'trialing', trial_ends_at: dias(5) }))).toBe('watch')
  })

  it('lo demás no es atención', () => {
    expect(getAttentionLevel(sub({ current_period_ends_at: dias(90) }))).toBe('none')
  })

  it('el conjunto de «Atención» no cambia: nadie entra ni sale', () => {
    // La pestaña, su contador y el orden por defecto dependen de `isAttention`.
    const casos = [
      sub({ status: 'past_due' }),
      sub({ current_period_ends_at: dias(-800) }),
      sub({ current_period_ends_at: dias(3) }),
      sub({ cancel_at_period_end: true }),
      sub({ status: 'trialing', trial_ends_at: dias(5) }),
      sub({ current_period_ends_at: dias(90) }),
    ]
    expect(casos.map(isAttention)).toEqual([true, true, true, true, true, false])
  })
})

/**
 * «Cuenta sin actividad» estaba última, después de «Actualizar periodo o
 * estado». Una cuenta abandonada casi siempre tiene además el período vencido,
 * así que la respuesta era el trámite y nunca el diagnóstico.
 */
describe('el diagnóstico dice lo que importa', () => {
  it('una cuenta vencida y sin uso se reporta como abandonada', () => {
    const abandonada = sub({
      current_period_ends_at: dias(-60),
      products_count: 0,
      sales_count: 0,
    })
    expect(getRecommendation(abandonada)).toBe('Cuenta sin actividad — seguimiento')
  })

  it('pero el cobro pendiente sigue mandando sobre todo', () => {
    const impaga = sub({ status: 'past_due', products_count: 0, sales_count: 0 })
    expect(getRecommendation(impaga)).toBe('Contactar por cobro pendiente')
  })

  it('y una cuenta que sí se usa mantiene el trámite', () => {
    const usada = sub({ current_period_ends_at: dias(-5), products_count: 10, sales_count: 3 })
    expect(getRecommendation(usada)).toBe('Actualizar periodo o estado')
  })
})

describe('la tabla se puede leer', () => {
  it('los encabezados están en castellano', () => {
    pintar([sub({})])
    // Decía «Owner» y «Organización / Tenant» en una interfaz en castellano.
    expect(screen.getByText('Responsable')).toBeInTheDocument()
    expect(screen.getByText('Organización')).toBeInTheDocument()
    expect(screen.queryByText('Owner')).not.toBeInTheDocument()
    expect(screen.queryByText(/Tenant/)).not.toBeInTheDocument()
  })

  it('el diagnóstico se lee entero, no truncado', () => {
    pintar([sub({ cancel_at_period_end: true })])
    // Era una columna de 170px con el texto completo escondido en un `title`.
    expect(screen.getByText('Revisar retención antes del cierre')).toBeInTheDocument()
  })

  it('sin ciclo definido no dibuja una barra en cero', () => {
    // Una barra en 0 se lee como «recién empieza», que es lo contrario de «no
    // se sabe».
    pintar([sub({ current_period_starts_at: null, current_period_ends_at: null })])
    expect(screen.getByText('Sin ciclo definido')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('con ciclo, la barra anuncia su avance', () => {
    pintar([sub({})])
    const barra = screen.getByRole('progressbar')
    expect(Number(barra.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    expect(barra).toHaveAttribute('aria-label', 'Avance del ciclo')
  })

  it('el menú de acciones está siempre visible, no sólo al pasar el mouse', () => {
    // Estaba en `opacity-0 group-hover:opacity-100`: en táctil no hay hover.
    pintar([sub({})])
    const menu = screen.getByRole('button', { name: /Opciones de Tienda Aurora/ })
    expect(menu.className).not.toContain('opacity-0')
  })
})

describe('se puede recorrer con el teclado', () => {
  it('el nombre de la organización es el control, y abre el detalle', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const usuario = userEvent.setup()
    const abrir = pintar([sub({})])

    const nombre = screen.getByRole('button', { name: 'Tienda Aurora' })
    await usuario.click(nombre)
    expect(abrir).toHaveBeenCalledTimes(1)
  })

  it('las filas ya no son cada una una parada de tabulador', () => {
    // Con cincuenta suscripciones eran cincuenta paradas antes de seguir.
    const { container } = render(
      <SubscriptionTable
        items={[sub({ id: 'a' }), sub({ id: 'b' }), sub({ id: 'c' })]}
        onOpenDetail={vi.fn()}
        onCopyValue={vi.fn()}
      />
    )
    expect(container.querySelectorAll('tr[tabindex="0"]')).toHaveLength(0)
  })
})

describe('lo que no se sabe no se muestra como un dato', () => {
  it('sin responsable lo dice, en vez de dejar el hueco', () => {
    pintar([sub({ owner_name: null, owner_email: null, owner_id: null })])
    expect(screen.getByText('Sin responsable')).toBeInTheDocument()
    expect(screen.getByText('Sin correo')).toBeInTheDocument()
  })

  it('sin plan pago dice «Sin costo» y no un cero', () => {
    pintar([sub({ plan_details: null })])
    expect(screen.getByText('Sin costo')).toBeInTheDocument()
  })

  it('sin slug cae al identificador, recortado', () => {
    pintar([sub({ organization_slug: null })])
    expect(screen.getByText(/org-0000…/)).toBeInTheDocument()
  })
})

describe('vacío', () => {
  it('explica qué hacer', () => {
    pintar([])
    expect(screen.getByText(/No hay suscripciones que coincidan/)).toBeInTheDocument()
    expect(screen.getByText(/Probá limpiar los filtros/)).toBeInTheDocument()
  })
})

describe('el uso se entiende sin pasar el mouse', () => {
  it('cada número lleva su nombre para quien no ve el icono', () => {
    pintar([sub({ members_count: 6, products_count: 240, sales_count: 1820 })])
    const fila = screen.getByRole('button', { name: 'Tienda Aurora' }).closest('tr')!
    expect(within(fila).getByTitle('6 usuarios')).toBeInTheDocument()
    expect(within(fila).getByTitle('240 productos')).toBeInTheDocument()
    expect(within(fila).getByTitle('1820 ventas')).toBeInTheDocument()
  })
})
