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
  pendingLinks: 22,
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
  pendingLinks: 14,
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

  /** Hay 22 nombres repetidos entre empresas: vincularlos a mano no escala. */
  it('vincula por nombre las marcas de empresas sueltas', async () => {
    const posts: unknown[] = []
    servidor(marcas, (body) => posts.push(body))
    render(<GlobalBrandsManager />)

    fireEvent.click(await screen.findByRole('button', { name: /Vincular por nombre \(22\)/ }))
    await waitFor(() => expect(posts).toEqual([{ action: 'link-existing' }]))
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
  it('avisa cuántas categorías de empresas quedan sin vincular', async () => {
    servidor(categorias)
    render(<GlobalCategoriesManager />)

    const vincular = await screen.findByRole('button', { name: /Vincular ahora/ })
    expect(vincular.closest('div')!).toHaveTextContent('14 categorías de empresas que coinciden por nombre')
    expect(screen.getByText('Sin vincular').closest('div')!).toHaveTextContent('116')
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
