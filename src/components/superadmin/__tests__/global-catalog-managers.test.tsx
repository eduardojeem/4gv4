import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlobalBrandsManager } from '../GlobalBrandsManager'
import { GlobalCategoriesManager } from '../GlobalCategoriesManager'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const marcas = {
  success: true,
  tenantTotal: 105,
  tenantLinked: 4,
  pendingLinks: 2,
  suggestions: [
    { id: 't1', name: 'samsung', organizationName: 'Store Center', targetId: 'b1', targetName: 'Samsung', targetLogoUrl: null },
    { id: 't2', name: 'SAMSUNG', organizationName: 'DA', targetId: 'b1', targetName: 'Samsung', targetLogoUrl: null },
  ],
  data: [
    { id: 'b1', name: 'Samsung', slug: 'samsung', aliases: ['Samsung Electronics'], logo_url: 'https://cdn/samsung.png', website: null, description: null, is_active: true, linked_count: 6 },
    { id: 'b2', name: 'Panadería', slug: 'panaderia', aliases: [], logo_url: null, website: null, description: null, is_active: true, linked_count: 0 },
    { id: 'b3', name: 'Vieja', slug: 'vieja', aliases: [], logo_url: null, website: null, description: null, is_active: false, linked_count: 0 },
  ],
}

const categorias = {
  success: true,
  tenantTotal: 116,
  tenantLinked: 0,
  pendingLinks: 1,
  suggestions: [
    { id: 'tc1', name: 'Telefonía', organizationName: 'DA', targetId: 'c2', targetName: 'Celulares', exact: true },
    { id: 'tc2', name: 'Pantallas', organizationName: 'Store Center', targetId: 'c2', targetName: 'Celulares', exact: false },
  ],
  data: [
    { id: 'c1', name: 'Electrónica', slug: 'electronica', description: null, parent_id: null, level: 0, aliases: ['Tecnología'], icon: null, sort_order: 1, is_active: true, linked_count: 3 },
    { id: 'c2', name: 'Celulares', slug: 'celulares', description: null, parent_id: 'c1', level: 1, aliases: [], icon: null, sort_order: 1, is_active: true, linked_count: 0 },
  ],
}

function servidor(payload: unknown, onPost?: (body: unknown) => void) {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      onPost?.(JSON.parse(String(init.body)))
      return { ok: true, status: 200, json: async () => ({ success: true, linked: 22 }) }
    }
    return { ok: true, status: 200, json: async () => payload }
  }))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('catálogo de marcas del superadmin', () => {
  it('muestra el trabajo pendiente: cuántas marcas no tienen logo oficial', async () => {
    servidor(marcas)
    render(<GlobalBrandsManager />)

    expect(await screen.findByText('Samsung')).toBeInTheDocument()
    const sinLogo = screen.getByText('Sin logo oficial').closest('div')!
    expect(within(sinLogo).getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Marcas de empresas').closest('div')!).toHaveTextContent('105')
  })

  it('filtra las que todavía no tienen logo', async () => {
    servidor(marcas)
    render(<GlobalBrandsManager />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Sin logo' }))
    await waitFor(() => expect(screen.queryByText('Samsung')).not.toBeInTheDocument())
    expect(screen.getByText('Panadería')).toBeInTheDocument()
  })

  /** El botón aplicaba los vínculos de una: antes hay que poder revisarlos. */
  it('muestra qué se va a vincular y con cuál del catálogo', async () => {
    servidor(marcas)
    render(<GlobalBrandsManager />)

    fireEvent.click(await screen.findByRole('button', { name: /Ver cuáles/ }))
    const panel = within(screen.getByRole('region', { name: 'marcas de empresas para vincular' }))
    expect(panel.getByText('samsung')).toBeInTheDocument()
    expect(panel.getByText('· Store Center')).toBeInTheDocument()
    expect(panel.getAllByText('Samsung').length).toBeGreaterThan(0)
  })

  it('vincula solo lo marcado', async () => {
    const posts: Array<Record<string, unknown>> = []
    servidor(marcas, (body) => posts.push(body as Record<string, unknown>))
    render(<GlobalBrandsManager />)

    fireEvent.click(await screen.findByRole('button', { name: /Ver cuáles/ }))
    const panel = within(screen.getByRole('region', { name: 'marcas de empresas para vincular' }))
    fireEvent.click(panel.getAllByRole('checkbox')[1])

    fireEvent.click(screen.getByRole('button', { name: /Vincular 1/ }))
    await waitFor(() => expect(posts).toEqual([{ action: 'link-existing', ids: ['t1'] }]))
  })

  /** Pegar una dirección dejaba el logo colgando de un servidor ajeno. */
  it('permite subir el logo al almacenamiento de la plataforma', async () => {
    const subidas: Array<{ url: string; body: unknown }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/logo')) {
        subidas.push({ url: String(url), body: init?.body })
        return { ok: true, status: 200, json: async () => ({ success: true, url: 'https://cdn/plataforma/samsung.png' }) }
      }
      return { ok: true, status: 200, json: async () => marcas }
    }))

    render(<GlobalBrandsManager />)
    fireEvent.click(await screen.findByRole('button', { name: /Nueva marca/ }))

    const archivo = new File(['x'], 'samsung.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [archivo] } })

    await waitFor(() => expect(subidas).toHaveLength(1))
    expect(subidas[0].body).toBeInstanceOf(FormData)
    await waitFor(() =>
      expect(screen.getByLabelText('Logo oficial (URL)')).toHaveValue('https://cdn/plataforma/samsung.png')
    )
  })

  it('una marca de baja se puede reactivar, no borrar', async () => {
    servidor(marcas)
    render(<GlobalBrandsManager />)

    fireEvent.click(await screen.findByRole('tab', { name: 'De baja' }))
    expect(await screen.findByRole('button', { name: 'Reactivar Vieja' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dar de baja Vieja' })).not.toBeInTheDocument()
  })
})

/**
 * El panel del superadmin estaba escrito en oscuro a mano (`bg-slate-950`,
 * `text-slate-400`), así que el interruptor de tema no cambiaba nada ahí.
 */
describe('el superadmin sigue el tema elegido', () => {
  it('no quedan colores fijos en el armazón ni en estas pantallas', () => {
    const paleta = /(?<![\w:-])(hover:|dark:|group-hover:)?(bg|text|border|ring|divide)-(slate|white|black)(-\d+)?(?![\w-])/

    for (const ruta of [
      'src/components/superadmin/superadmin-shell.tsx',
      'src/app/superadmin/layout.tsx',
      'src/components/superadmin/GlobalBrandsManager.tsx',
      'src/components/superadmin/GlobalCategoriesManager.tsx',
    ]) {
      expect(readFileSync(resolve(process.cwd(), ruta), 'utf8')).not.toMatch(paleta)
    }
  })
})

describe('categorías globales del superadmin', () => {
  it('muestra qué categoría de qué empresa se une a cuál', async () => {
    servidor(categorias)
    render(<GlobalCategoriesManager />)

    fireEvent.click(await screen.findByRole('button', { name: /Ver cuáles/ }))
    const panel = within(screen.getByRole('region', { name: 'categorías de empresas para vincular' }))
    expect(panel.getByText('Telefonía')).toBeInTheDocument()
    expect(panel.getByText('· DA')).toBeInTheDocument()
    expect(screen.getByText('Sin vincular').closest('div')!).toHaveTextContent('116')
  })

  /** Una coincidencia aproximada es una propuesta: no se aplica sola. */
  it('deja sin marcar las coincidencias aproximadas', async () => {
    servidor(categorias)
    render(<GlobalCategoriesManager />)

    fireEvent.click(await screen.findByRole('button', { name: /Ver cuáles/ }))
    const panel = within(screen.getByRole('region', { name: 'categorías de empresas para vincular' }))
    expect(panel.getByText('aproximada')).toBeInTheDocument()

    const casillas = panel.getAllByRole('checkbox') as HTMLInputElement[]
    expect(casillas[0].checked).toBe(true)
    expect(casillas[1].checked).toBe(false)
    expect(screen.getByRole('button', { name: /Vincular 1/ })).toBeInTheDocument()
  })

  it('muestra de qué categoría madre cuelga cada una y cuáles no se usan', async () => {
    servidor(categorias)
    render(<GlobalCategoriesManager />)

    expect(await screen.findByText('en Electrónica')).toBeInTheDocument()
    expect(screen.getByTitle('Ninguna empresa usa esta categoría todavía')).toBeInTheDocument()
  })

  it('filtra por categorías principales', async () => {
    servidor(categorias)
    render(<GlobalCategoriesManager />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Principales' }))
    await waitFor(() => expect(screen.queryByText('Celulares')).not.toBeInTheDocument())
    expect(screen.getByText('Electrónica')).toBeInTheDocument()
  })
})
