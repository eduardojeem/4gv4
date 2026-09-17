import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingContentDashboard, type LandingRow } from '@/components/superadmin/LandingContentDashboard'
import { assessLanding, normalizeHeroTitle } from '@/lib/superadmin/landing-readiness'
import { summarizeCommerce } from '@/lib/superadmin/landing-commerce'
import { resolveCommerceRange } from '@/lib/superadmin/commerce-range'
import { EMPTY_LANDING_FILTERS } from '@/lib/superadmin/landing-filters'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

const PLANTILLA = new Set([normalizeHeroTitle('Los mejores productos al mejor precio')])

const tienda = (slug: string, name: string, over: Partial<Parameters<typeof assessLanding>[0]> = {}): LandingRow => {
  const input = {
    storefrontPublic: true,
    organizationLogoUrl: null,
    activeProducts: 20,
    templateHeroTitles: PLANTILLA,
    settings: [
      { key: 'company_info', value: { whatsapp: '0981', logoUrl: 'https://cdn/l.png', address: 'Centro', instagram: '@x' }, updated_at: '2026-09-14T10:00:00Z' },
      { key: 'hero_content', value: { title: `Lo mejor de ${name}` }, updated_at: null },
      { key: 'promotional_carousel', value: { enabled: true, slides: [{ active: true, imageUrl: 'https://cdn/1.jpg' }] }, updated_at: null },
    ],
    ...over,
  }
  return {
    id: slug, name, slug, plan: 'PRO', logoUrl: null, marketplacePublic: true,
    activeProducts: input.activeProducts, assessment: assessLanding(input),
  }
}

const filas = [
  tienda('store-center', 'Store Center'),
  tienda('yulicel', 'Yulicel', { activeProducts: 0 }),
  tienda('raices', 'Raíces', { storefrontPublic: false }),
  tienda('hca', 'HCA Celular', {
    settings: [
      { key: 'company_info', value: { phone: '021' }, updated_at: null },
      { key: 'hero_content', value: { title: 'Los mejores productos al mejor precio' }, updated_at: null },
    ],
  }),
]

const renderizar = () =>
  render(<LandingContentDashboard rows={filas} failed={false} referenceTime="2026-09-16T12:00:00Z" />)

describe('landings de las tiendas', () => {
  it('cuenta las tiendas por estado', () => {
    renderizar()
    const estados = within(screen.getByRole('region', { name: 'Estado de las landings' }))
    expect(estados.getByRole('button', { name: /Lista para vender/ })).toHaveTextContent(/1\s*de 4/)
    expect(estados.getByRole('button', { name: /Incompleta/ })).toHaveTextContent(/2\s*de 4/)
    expect(estados.getByRole('button', { name: /No publicada/ })).toHaveTextContent(/1\s*de 4/)
  })

  /** Lo urgente primero: las incompletas antes que las listas. */
  it('ordena la lista con lo que pide acción arriba', () => {
    renderizar()
    const orden = screen.getAllByTestId(/^landing-/).map((fila) => fila.getAttribute('data-testid'))
    expect(orden.indexOf('landing-store-center')).toBe(orden.length - 1)
    expect(orden.indexOf('landing-hca')).toBeLessThan(orden.indexOf('landing-raices'))
  })

  it('un cuadro de estado filtra la lista, y se quita con otro toque', () => {
    renderizar()
    const estados = within(screen.getByRole('region', { name: 'Estado de las landings' }))
    fireEvent.click(estados.getByRole('button', { name: /No publicada/ }))
    expect(screen.getAllByTestId(/^landing-/)).toHaveLength(1)
    expect(screen.getByTestId('landing-raices')).toBeInTheDocument()

    fireEvent.click(estados.getByRole('button', { name: /No publicada/ }))
    expect(screen.getAllByTestId(/^landing-/)).toHaveLength(4)
  })

  it('tocar lo que falta muestra a quiénes les falta', () => {
    renderizar()
    fireEvent.click(screen.getByRole('button', { name: /^Productos/ }))
    expect(screen.getAllByTestId(/^landing-/).map((fila) => fila.getAttribute('data-testid'))).toEqual(['landing-yulicel'])
    expect(screen.getByRole('button', { name: /Sin productos/ })).toBeInTheDocument()
  })

  /** Antes, una portada de la plantilla contaba como personalizada. */
  it('en la lista dice qué le falta a cada tienda', () => {
    renderizar()
    const hca = within(screen.getByTestId('landing-hca'))
    expect(hca.getByText('Incompleta')).toBeInTheDocument()
    expect(hca.getByText('Falta: Logo · Portada propia')).toBeInTheDocument()
    expect(within(screen.getByTestId('landing-store-center')).getByText('Completa')).toBeInTheDocument()
  })

  it('en tarjetas muestra la portada, marca la de plantilla y la lista completa', () => {
    renderizar()
    fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }))
    const hca = within(screen.getByTestId('landing-hca'))
    expect(hca.getByText('plantilla')).toBeInTheDocument()
    expect(hca.getByText('Logo').closest('li')).toHaveAttribute('title', 'Sin logo la tienda se muestra con la inicial.')
    expect(hca.getAllByRole('listitem')).toHaveLength(8)
  })

  it('cada tienda enlaza a su landing y a su ficha', () => {
    renderizar()
    const fila = within(screen.getByTestId('landing-store-center'))
    expect(fila.getByRole('link', { name: 'Ver la landing de Store Center' })).toHaveAttribute('href', '/store-center/inicio')
    expect(fila.getByRole('link', { name: 'Ficha de Store Center' })).toHaveAttribute('href', '/superadmin/organizations/store-center')
    expect(fila.getByText('editada hace 2 días')).toBeInTheDocument()
  })

  it('busca por nombre', () => {
    renderizar()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar tienda' }), { target: { value: 'yuli' } })
    expect(screen.getAllByTestId(/^landing-/)).toHaveLength(1)
  })

  it('un fallo al leer no se muestra como una plataforma sin tiendas', () => {
    render(<LandingContentDashboard rows={[]} failed referenceTime="2026-09-16T12:00:00Z" />)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron leer las tiendas')
  })
})

// ── Resultados comerciales ──────────────────────────────────────────────────

describe('resultados comerciales de las tiendas', () => {
  const NOW = new Date('2026-09-16T15:00:00Z').getTime()
  const hace = (dias: number) => new Date(NOW - dias * 86_400_000).toISOString()

  const comercio = (visitas: boolean) => summarizeCommerce({
    range: resolveCommerceRange({ periodo: '7' }, NOW),
    sales: [
      { organization_id: 'store-center', total_amount: 300_000, status: 'completed', created_at: hace(1) },
      { organization_id: 'store-center', total_amount: 100_000, status: 'completed', created_at: hace(10) },
    ],
    orders: [{ organization_id: 'yulicel', total: 50_000, status: 'ENTREGADO', payment_status: 'PAGADO', created_at: hace(2) }],
    visits: visitas ? [{ organization_id: 'yulicel', day: '2026-09-15', page: 'inicio', views: 40, visitors: 10 }] : null,
    items: [{ organization_id: 'store-center', product_key: 'p1', product_name: 'Parlante JBL', quantity: 2, total: 300_000, created_at: hace(1), countable: true }],
  })

  const conComercio = (visitas = true) =>
    render(<LandingContentDashboard rows={filas} failed={false} referenceTime="2026-09-16T15:00:00Z" commerce={comercio(visitas)} range={resolveCommerceRange({ periodo: '7' }, new Date('2026-09-16T15:00:00Z').getTime())} />)

  it('muestra lo vendido con su variación y el detalle por canal', () => {
    conComercio()
    const panel = within(screen.getByRole('region', { name: 'Resultados comerciales' }))
    expect(panel.getByText('Gs. 350.000')).toBeInTheDocument()
    expect(panel.getByText(/\+250% vs\. período anterior/)).toBeInTheDocument()
    expect(panel.getByText('1 venta en el local')).toBeInTheDocument()
    expect(panel.getByText('Gs. 50.000 cobrados')).toBeInTheDocument()
  })

  it('cuenta visitantes y cuántos terminaron en pedido', () => {
    conComercio()
    const panel = within(screen.getByRole('region', { name: 'Resultados comerciales' }))
    expect(panel.getByText('40 páginas vistas · 10% hizo un pedido')).toBeInTheDocument()
    expect(within(panel.getByTestId('commerce-yulicel')).getByText('10%')).toBeInTheDocument()
  })

  /** Sin la migración no hay visitas: mostrarlas en cero sería falso. */
  it('sin registro de visitas lo explica en vez de mostrar ceros', () => {
    conComercio(false)
    const panel = within(screen.getByRole('region', { name: 'Resultados comerciales' }))
    expect(panel.getByText(/Las visitas se empiezan a contar cuando se aplica la migración/)).toBeInTheDocument()
    expect(panel.getByText('Sin registro de visitas')).toBeInTheDocument()
  })

  it('ordena las tiendas por ventas y muestra lo más vendido', () => {
    conComercio()
    const panel = within(screen.getByRole('region', { name: 'Resultados comerciales' }))
    const filasRanking = panel.getAllByTestId(/^commerce-/).map((fila) => fila.getAttribute('data-testid'))
    expect(filasRanking).toEqual(['commerce-store-center', 'commerce-yulicel'])
    expect(panel.getByText('Parlante JBL')).toBeInTheDocument()
    expect(panel.getByText('2 u.')).toBeInTheDocument()
  })

  it('el período se cambia con enlaces', () => {
    conComercio()
    expect(screen.getByRole('link', { name: '30 días' })).toHaveAttribute('href', '?periodo=30')
    expect(screen.getByRole('link', { name: '7 días' })).toHaveAttribute('aria-current', 'page')
  })

  it('cada tienda de la lista dice cuánto vendió y cuántas visitas tuvo', () => {
    conComercio()
    expect(screen.getByTestId('store-sales-store-center')).toHaveTextContent('Gs. 300.0001 en local · 0 pedidos web')
    expect(screen.getByTestId('store-sales-raices')).toHaveTextContent('Sin ventas')
    expect(within(screen.getByTestId('landing-yulicel')).getByText('10% pidió')).toBeInTheDocument()
  })

  it('ordena por ventas', () => {
    conComercio()
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar' }), { target: { value: 'sales' } })
    const orden = screen.getAllByTestId(/^landing-/).map((fila) => fila.getAttribute('data-testid'))
    expect(orden.slice(0, 2)).toEqual(['landing-store-center', 'landing-yulicel'])
  })

  it('un fallo al leer las ventas se avisa', () => {
    render(<LandingContentDashboard rows={filas} failed={false} referenceTime="2026-09-16T15:00:00Z" commerce={null} range={resolveCommerceRange({ periodo: '30' }, new Date('2026-09-16T15:00:00Z').getTime())} />)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron leer las ventas o los pedidos')
  })
})

describe('paginación de la lista de tiendas', () => {
  const muchas = Array.from({ length: 23 }, (_, i) => tienda(`tienda-${String(i + 1).padStart(2, '0')}`, `Tienda ${String(i + 1).padStart(2, '0')}`))
  const renderMuchas = () =>
    render(<LandingContentDashboard rows={muchas} failed={false} referenceTime="2026-09-16T12:00:00Z" />)

  it('muestra 10 por página y deja pasar a la siguiente', () => {
    renderMuchas()
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar' }), { target: { value: 'name' } })
    expect(screen.getAllByTestId(/^landing-/)).toHaveLength(10)
    expect(screen.getByText('Mostrando 1 a 10 de 23 resultados')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ir a la página 3' }))
    expect(screen.getAllByTestId(/^landing-/).map((f) => f.getAttribute('data-testid'))).toEqual([
      'landing-tienda-21', 'landing-tienda-22', 'landing-tienda-23',
    ])
  })

  it('buscar vuelve a la primera página', () => {
    renderMuchas()
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la página 3' }))
    expect(screen.getByText('Mostrando 21 a 23 de 23 resultados')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar tienda' }), { target: { value: 'tienda' } })
    expect(screen.getByText('Mostrando 1 a 10 de 23 resultados')).toBeInTheDocument()
  })

  it('las tarjetas también se paginan', () => {
    renderMuchas()
    fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }))
    expect(screen.getAllByTestId(/^landing-/)).toHaveLength(10)
  })
})

describe('tarjetas con el color de cada tienda y detalle', () => {
  const conMarca = [
    { ...tienda('store-center', 'Store Center'), brandColor: 'custom', customBrandColor: '#212536' },
    { ...tienda('fashion', 'Fashion Plus'), brandColor: 'amber', customBrandColor: '' },
    tienda('yulicel', 'Yulicel', { activeProducts: 0 }),
  ]
  const renderMarca = () =>
    render(<LandingContentDashboard rows={conMarca} failed={false} referenceTime="2026-09-16T12:00:00Z" />)

  it('cada tarjeta toma el color que la tienda eligió para su página', () => {
    renderMarca()
    fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }))
    const propia = screen.getByTestId('landing-store-center')
    expect(propia).toHaveAttribute('data-custom-brand', '')
    expect(propia.style.getPropertyValue('--brand-primary')).toBe('#212536')
    expect(screen.getByTestId('landing-fashion')).toHaveAttribute('data-color-scheme', 'amber')
    expect(screen.getByTestId('landing-yulicel')).toHaveAttribute('data-color-scheme', 'blue')
  })

  it('«Detalle» abre la tienda con lo que le falta, su contenido y su color', async () => {
    renderMarca()
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Yulicel' }))
    const modal = within(await screen.findByRole('dialog'))
    expect(modal.getByRole('heading', { name: 'Yulicel' })).toBeInTheDocument()
    expect(modal.getByText('No tiene productos activos: la landing no muestra nada para comprar.')).toBeInTheDocument()
    expect(modal.getByText('Azul (por defecto)')).toBeInTheDocument()
    expect(modal.getByRole('link', { name: /Abrir la tienda/ })).toHaveAttribute('href', '/yulicel/inicio')
    expect(modal.getByRole('link', { name: /Ficha de la organización/ })).toHaveAttribute('href', '/superadmin/organizations/yulicel')
  })

  it('también se abre desde la tarjeta y muestra el color propio', async () => {
    renderMarca()
    fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }))
    fireEvent.click(within(screen.getByTestId('landing-store-center')).getByRole('button', { name: 'Ver detalle de Store Center' }))
    const modal = within(await screen.findByRole('dialog'))
    expect(modal.getByText('Propio (#212536)')).toBeInTheDocument()
    expect(modal.getByTestId('store-detail-brand')).toHaveAttribute('data-custom-brand', '')
  })

  it('con métricas, el detalle muestra cómo vendió la tienda', async () => {
    const NOW = new Date('2026-09-16T15:00:00Z').getTime()
    const commerce = summarizeCommerce({
      range: resolveCommerceRange({ periodo: '30' }, NOW),
      sales: [{ organization_id: 'yulicel', total_amount: 120_000, status: 'completed', created_at: new Date(NOW - 86_400_000).toISOString() }],
      orders: [],
      visits: null,
      items: [],
    })
    render(<LandingContentDashboard rows={conMarca} failed={false} referenceTime="2026-09-16T15:00:00Z" commerce={commerce} range={resolveCommerceRange({ periodo: '30' }, new Date('2026-09-16T15:00:00Z').getTime())} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Yulicel' }))
    const modal = within(await screen.findByRole('dialog'))
    expect(modal.getByText('Cómo vendió en los últimos 30 días')).toBeInTheDocument()
    expect(modal.getAllByText('Gs. 120.000')).toHaveLength(2)
    expect(modal.getByText('Sin registro de visitas')).toBeInTheDocument()
  })
})

/** Abre un menú de la barra de filtros y devuelve el grupo de opciones pedido. */
async function abrirMenu(boton: RegExp, grupo: string, radio = false) {
  fireEvent.click(within(screen.getByRole('search', { name: 'Filtrar tiendas' })).getByRole('button', { name: boton }))
  return within(await screen.findByRole(radio ? 'radiogroup' : 'group', { name: grupo }))
}

describe('barra de filtros de las tiendas', () => {
  const NOW = new Date('2026-09-16T15:00:00Z').getTime()
  const variadas = [
    { ...tienda('store-center', 'Store Center'), marketplacePublic: true },
    { ...tienda('yulicel', 'Yulicel', { activeProducts: 0 }), marketplacePublic: true },
    { ...tienda('hca', 'HCA Celular', { settings: [{ key: 'company_info', value: { phone: '021' }, updated_at: null }] }), marketplacePublic: false },
    { ...tienda('raices', 'Raíces', { storefrontPublic: false }), marketplacePublic: false },
  ]
  const commerce = summarizeCommerce({
    range: resolveCommerceRange({ periodo: '30' }, NOW),
    sales: [{ organization_id: 'hca', total_amount: 90_000, status: 'completed', created_at: new Date(NOW - 86_400_000).toISOString() }],
    orders: [], visits: null, items: [],
  })
  const slugs = () => screen.getAllByTestId(/^landing-/).map((fila) => fila.getAttribute('data-testid'))
  const renderBarra = (initialFilters?: Parameters<typeof LandingContentDashboard>[0]['initialFilters']) =>
    render(<LandingContentDashboard rows={variadas} failed={false} referenceTime="2026-09-16T15:00:00Z" commerce={commerce} range={resolveCommerceRange({ periodo: '30' }, new Date('2026-09-16T15:00:00Z').getTime())} initialFilters={initialFilters} />)

  beforeEach(() => { window.history.replaceState(null, '', '/superadmin/web-content/landing') })

  it('los estados se combinan y cada uno dice cuántas tiendas hay', async () => {
    renderBarra()
    const estado = await abrirMenu(/^Estado/, 'Estado')
    expect(estado.getByRole('checkbox', { name: /Incompleta/ }).closest('label')).toHaveTextContent('2')
    fireEvent.click(estado.getByRole('checkbox', { name: /Incompleta/ }))
    fireEvent.click(estado.getByRole('checkbox', { name: /No publicada/ }))
    expect(slugs().sort()).toEqual(['landing-hca', 'landing-raices', 'landing-yulicel'])
    // El botón dice cuántos hay elegidos.
    expect(within(screen.getByRole('search', { name: 'Filtrar tiendas' })).getByRole('button', { name: /^Estado/ })).toHaveTextContent('2')
  })

  /** Antes, un filtro a la vez: no se podía pedir «incompletas que vendieron». */
  it('combina estado con ventas y fuera del marketplace', async () => {
    renderBarra()
    fireEvent.click((await abrirMenu(/^Estado/, 'Estado')).getByRole('checkbox', { name: /Incompleta/ }))
    fireEvent.click((await abrirMenu(/Más filtros/, 'Ventas (30 días)', true)).getByRole('radio', { name: /Con ventas/ }))
    expect(slugs()).toEqual(['landing-hca'])
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Marketplace' })).getByRole('radio', { name: /Visibles en el marketplace/ }))
    expect(screen.getByText('Ninguna tienda cumple todos los filtros.')).toBeInTheDocument()
  })

  it('«Le falta» elige varias cosas a la vez', async () => {
    renderBarra()
    fireEvent.click(screen.getByRole('button', { name: /Le falta/ }))
    fireEvent.click(await screen.findByRole('checkbox', { name: /Productos/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Publicada/ }))
    expect(slugs().sort()).toEqual(['landing-raices', 'landing-yulicel'])
  })

  it('muestra los filtros activos, se sacan de a uno o todos juntos', () => {
    renderBarra({ ...EMPTY_LANDING_FILTERS, statuses: ['incomplete', 'hidden'], missing: ['logo'] })
    const activos = within(screen.getByRole('list', { name: 'Filtros activos' }))
    expect(activos.getAllByRole('button')).toHaveLength(3)

    fireEvent.click(activos.getByRole('button', { name: 'Quitar filtro: No publicada' }))
    expect(within(screen.getByRole('list', { name: 'Filtros activos' })).getAllByRole('button')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros (2)' }))
    expect(screen.queryByRole('list', { name: 'Filtros activos' })).not.toBeInTheDocument()
    expect(slugs()).toHaveLength(4)
  })

  it('los cuadros de arriba y la barra usan los mismos filtros', async () => {
    renderBarra()
    fireEvent.click(within(screen.getByRole('region', { name: 'Estado de las landings' })).getByRole('button', { name: /No publicada/ }))
    expect((await abrirMenu(/^Estado/, 'Estado')).getByRole('checkbox', { name: /No publicada/ })).toBeChecked()
    expect(slugs()).toEqual(['landing-raices'])
  })

  it('quedan en la dirección, y cambiar de período los conserva', async () => {
    renderBarra()
    fireEvent.click((await abrirMenu(/^Estado/, 'Estado')).getByRole('checkbox', { name: /Incompleta/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar tienda' }), { target: { value: 'hca' } })
    await waitFor(() => expect(window.location.search).toBe('?q=hca&estado=incomplete'))
    expect(screen.getByRole('link', { name: '7 días' })).toHaveAttribute('href', '?q=hca&estado=incomplete&periodo=7')
  })

  it('arranca con los filtros que vienen en la dirección', () => {
    renderBarra({ ...EMPTY_LANDING_FILTERS, missing: ['products'] })
    expect(slugs()).toEqual(['landing-yulicel'])
  })
})

describe('funciones del filtro de tiendas', () => {
  const NOW = new Date('2026-09-16T15:00:00Z').getTime()
  const variadas = [
    { ...tienda('store-center', 'Store Center'), plan: 'PRO', vertical: 'electronics' },
    { ...tienda('yulicel', 'Yulicel', { activeProducts: 0 }), plan: 'FREE', vertical: 'electronics' },
    { ...tienda('raices', 'Raíces y Diseños', { storefrontPublic: false }), plan: 'FREE', vertical: 'hardware' },
  ]
  const commerce = summarizeCommerce({ range: resolveCommerceRange({ periodo: '30' }, NOW), sales: [], orders: [], visits: null, items: [] })
  const slugs = () => screen.getAllByTestId(/^landing-/).map((fila) => fila.getAttribute('data-testid'))
  const renderFunciones = () =>
    render(<LandingContentDashboard rows={variadas} failed={false} referenceTime="2026-09-16T15:00:00Z" commerce={commerce} range={resolveCommerceRange({ periodo: '30' }, new Date('2026-09-16T15:00:00Z').getTime())} />)

  beforeEach(() => { window.history.replaceState(null, '', '/superadmin/web-content/landing') })

  it('las vistas rápidas aplican sus filtros y se quitan con otro toque', () => {
    renderFunciones()
    const vistas = within(screen.getByRole('group', { name: 'Vistas rápidas' }))
    const sinProductos = vistas.getByRole('button', { name: /Publicadas sin productos/ })
    expect(sinProductos).toHaveTextContent('1')
    fireEvent.click(sinProductos)
    expect(slugs()).toEqual(['landing-yulicel'])
    expect(sinProductos).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(sinProductos)
    expect(slugs()).toHaveLength(3)
  })

  it('busca sin importar las tildes', () => {
    renderFunciones()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar tienda' }), { target: { value: 'raices' } })
    expect(slugs()).toEqual(['landing-raices'])
  })

  it('«/» lleva al buscador y Escape lo borra', () => {
    renderFunciones()
    fireEvent.keyDown(window, { key: '/' })
    const buscador = screen.getByRole('textbox', { name: 'Buscar tienda' })
    expect(buscador).toHaveFocus()
    fireEvent.change(buscador, { target: { value: 'yuli' } })
    fireEvent.keyDown(buscador, { key: 'Escape' })
    expect(buscador).toHaveValue('')
  })

  it('«Más filtros» junta plan y rubro, con sus nombres en castellano', async () => {
    renderFunciones()
    fireEvent.click((await abrirMenu(/Más filtros/, 'Plan')).getByRole('checkbox', { name: /FREE/ }))
    expect(slugs().sort()).toEqual(['landing-raices', 'landing-yulicel'])

    fireEvent.click(within(screen.getByRole('group', { name: 'Rubro' })).getByRole('checkbox', { name: /Ferretería/ }))
    expect(slugs()).toEqual(['landing-raices'])
    expect(screen.getByRole('button', { name: 'Quitar filtro: Ferretería' })).toBeInTheDocument()
    expect(within(screen.getByRole('search', { name: 'Filtrar tiendas' })).getByRole('button', { name: /Más filtros/ })).toHaveTextContent('2')
  })

  it('filtra por cuándo se editó', async () => {
    renderFunciones()
    // Las tres se editaron hace dos días: ninguna figura como nunca editada.
    fireEvent.click((await abrirMenu(/Más filtros/, 'Página editada', true)).getByRole('radio', { name: /Nunca/ }))
    expect(screen.getByText('Ninguna tienda cumple todos los filtros.')).toBeInTheDocument()
  })

  /** Sin filtros no hay renglón de elegidos: la barra queda limpia. */
  it('el renglón de lo elegido aparece solo cuando hay algo elegido', async () => {
    renderFunciones()
    expect(screen.queryByRole('list', { name: 'Filtros activos' })).not.toBeInTheDocument()
    fireEvent.click((await abrirMenu(/^Estado/, 'Estado')).getByRole('checkbox', { name: /No publicada/ }))
    expect(screen.getByRole('list', { name: 'Filtros activos' })).toBeInTheDocument()
    expect(screen.getByText('1 tienda')).toBeInTheDocument()
  })

  it('exporta lo que se ve', async () => {
    const createObjectURL = vi.fn(() => 'blob:tiendas')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderFunciones()
    fireEvent.click((await abrirMenu(/^Estado/, 'Estado')).getByRole('checkbox', { name: /No publicada/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Exportar 1 tienda' }))

    expect(click).toHaveBeenCalledTimes(1)
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    expect(blob.type).toBe('text/csv;charset=utf-8')
    click.mockRestore()
  })
})

describe('selector de período', () => {
  const NOW = new Date('2026-09-16T15:00:00Z').getTime()
  const renderPeriodo = (params: Record<string, string>) => {
    const range = resolveCommerceRange(params, NOW, 2024)
    const commerce = summarizeCommerce({ range, sales: [], orders: [], visits: null, items: [] })
    render(<LandingContentDashboard rows={filas} failed={false} referenceTime="2026-09-16T15:00:00Z" commerce={commerce} range={range} firstYear={2024} />)
    return within(screen.getByRole('navigation', { name: 'Período' }))
  }

  it('ofrece de 7 días a 12 meses y lo que va del año', () => {
    const periodo = renderPeriodo({ periodo: '180' })
    for (const [nombre, valor] of [['7 días', '7'], ['30 días', '30'], ['90 días', '90'], ['6 meses', '180'], ['12 meses', '365'], ['Este año', 'anio']]) {
      expect(periodo.getByRole('link', { name: nombre })).toHaveAttribute('href', `?periodo=${valor}`)
    }
    expect(periodo.getByRole('link', { name: '6 meses' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(/Del 21 mar\.? 2026 al 16 sept?\.? 2026 \(180 días\)/)).toBeInTheDocument()
    expect(screen.getByText('Vendido por semana')).toBeInTheDocument()
  })

  it('permite elegir un año completo desde el primero con organizaciones', async () => {
    const periodo = renderPeriodo({ periodo: '2025' })
    fireEvent.click(periodo.getByRole('button', { name: /2025/ }))
    const años = await screen.findAllByRole('link', { name: /^20\d\d/ })
    expect(años.map((link) => link.getAttribute('href'))).toEqual(['?periodo=2026', '?periodo=2025', '?periodo=2024'])
    expect(screen.getByText(/se compara con el 1 ene\.? 2024 al 31 dic\.? 2024/)).toBeInTheDocument()
    expect(screen.getByText('Vendido por mes')).toBeInTheDocument()
  })

  it('un rango de fechas se valida antes de aplicarlo', async () => {
    const periodo = renderPeriodo({})
    fireEvent.click(periodo.getByRole('button', { name: /Fechas/ }))
    const desde = await screen.findByLabelText('Desde')
    const hasta = screen.getByLabelText('Hasta')

    fireEvent.change(desde, { target: { value: '2026-09-10' } })
    fireEvent.change(hasta, { target: { value: '2026-09-01' } })
    expect(screen.getByText('La fecha «desde» tiene que ser anterior a «hasta».')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver este período' })).toBeDisabled()

    fireEvent.change(desde, { target: { value: '2026-06-01' } })
    fireEvent.change(hasta, { target: { value: '2026-08-31' } })
    expect(screen.getByText('92 días')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver este período' })).toHaveAttribute('href', '?desde=2026-06-01&hasta=2026-08-31')
  })

  it('cambiar de período conserva los filtros de la lista', () => {
    const range = resolveCommerceRange({}, NOW, 2024)
    const commerce = summarizeCommerce({ range, sales: [], orders: [], visits: null, items: [] })
    render(<LandingContentDashboard rows={filas} failed={false} referenceTime="2026-09-16T15:00:00Z" commerce={commerce} range={range} firstYear={2024} initialFilters={{ ...EMPTY_LANDING_FILTERS, statuses: ['hidden'] }} />)
    expect(within(screen.getByRole('navigation', { name: 'Período' })).getByRole('link', { name: 'Este año' })).toHaveAttribute('href', '?estado=hidden&periodo=anio')
  })
})
