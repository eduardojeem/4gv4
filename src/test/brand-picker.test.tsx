import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { BrandPicker } from '@/components/dashboard/brands/BrandPicker'
import { filterBrands, findExistingBrand, normalizeBrandName } from '@/lib/brands/match'

/**
 * La marca del producto se elegía en una lista desplegable sin búsqueda, y
 * crear una estaba detrás de un «+» sin texto. Con veinticinco marcas cargadas
 * buscar era bajar a mano, y como crear estaba a un clic y buscar no, el
 * catálogo terminó con «Samsung» y «SAMSUNG» como dos marcas distintas.
 */

const MARCAS = [
  { id: '1', name: 'Samsung' },
  { id: '2', name: 'Sony' },
  { id: '3', name: 'Western Digital' },
  { id: '4', name: 'Genérico' },
]

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

// cmdk mueve el resaltado con scrollIntoView, que jsdom no trae.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('comparar nombres de marca', () => {
  it('no distingue mayúsculas ni acentos', () => {
    expect(normalizeBrandName('SAMSUNG')).toBe(normalizeBrandName('Samsung'))
    expect(normalizeBrandName('Genérico')).toBe(normalizeBrandName('generico'))
    expect(normalizeBrandName('  Western   Digital ')).toBe('western digital')
  })

  it('las que empiezan igual van primero', () => {
    const resultado = filterBrands([...MARCAS, { id: '5', name: 'Pro Sound' }], 'so')
    expect(resultado.map((m) => m.name)).toEqual(['Sony', 'Pro Sound'])
  })

  it('sin nada escrito devuelve todas, ordenadas', () => {
    expect(filterBrands(MARCAS, '').map((m) => m.name)).toEqual([
      'Genérico',
      'Samsung',
      'Sony',
      'Western Digital',
    ])
  })

  /** Crear una que ya existe termina en un 409 que el usuario no entiende. */
  it('encuentra la marca que ya se llama así, escrita de otra forma', () => {
    expect(findExistingBrand(MARCAS, 'samsung')?.id).toBe('1')
    expect(findExistingBrand(MARCAS, ' GENERICO ')?.id).toBe('4')
    expect(findExistingBrand(MARCAS, 'Xiaomi')).toBeNull()
    expect(findExistingBrand(MARCAS, '   ')).toBeNull()
  })
})

const montar = (props: Partial<React.ComponentProps<typeof BrandPicker>> = {}) => {
  const onSelect = vi.fn()
  const onCreate = vi.fn()
  render(<BrandPicker brands={MARCAS} onSelect={onSelect} onCreate={onCreate} {...props} />)
  return { onSelect, onCreate }
}

const abrir = async () => {
  await userEvent.click(screen.getByRole('combobox'))
  return screen.getByLabelText(/Buscar una marca/i)
}

describe('elegir o crear la marca de un producto', () => {
  it('el botón invita a buscar, no solo a elegir de una lista', () => {
    montar()
    expect(screen.getByRole('combobox')).toHaveTextContent('Buscar o crear una marca')
  })

  it('al abrir, el buscador dice cuántas marcas hay para buscar', async () => {
    montar()
    const buscador = await abrir()
    expect(buscador).toHaveAttribute('placeholder', expect.stringContaining('4 marcas'))
  })

  /** Crear es a lo que se viene: está primero y con el nombre escrito. */
  it('ofrece crear con el nombre que se está escribiendo', async () => {
    const { onCreate } = montar()
    const buscador = await abrir()

    await userEvent.type(buscador, 'Xiaomi')
    const crear = screen.getByRole('option', { name: /Crear la marca «Xiaomi»/i })
    expect(crear).toBeInTheDocument()

    await userEvent.click(crear)
    expect(onCreate).toHaveBeenCalledWith('Xiaomi')
  })

  it('mientras escribe ya ve las que tiene', async () => {
    montar()
    const buscador = await abrir()

    await userEvent.type(buscador, 'sam')

    expect(screen.getByRole('option', { name: /^Samsung/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /^Sony/ })).not.toBeInTheDocument()
  })

  /** El caso que llenó el catálogo de duplicados. */
  it('si la marca ya existe no ofrece crearla: ofrece elegirla', async () => {
    montar()
    const buscador = await abrir()

    await userEvent.type(buscador, 'SAMSUNG')

    expect(screen.queryByRole('option', { name: /Crear la marca/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Ya tenés «Samsung»/)).toBeInTheDocument()
  })

  it('elegir una marca la devuelve entera, no solo el id', async () => {
    const { onSelect } = montar()
    const buscador = await abrir()

    await userEvent.type(buscador, 'western')
    await userEvent.click(screen.getByRole('option', { name: /Western Digital/ }))

    expect(onSelect).toHaveBeenCalledWith({ id: '3', name: 'Western Digital' })
  })

  it('con una marca elegida se puede volver a dejarlo sin marca', async () => {
    const { onSelect } = montar({ value: '1' })
    expect(screen.getByRole('combobox')).toHaveTextContent('Samsung')

    await abrir()
    await userEvent.click(screen.getByRole('option', { name: /sin marca/i }))

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('avisa cuando ninguna coincide, sin esconder el crear', async () => {
    montar()
    const buscador = await abrir()

    await userEvent.type(buscador, 'zzz')

    expect(screen.getByText(/Ninguna de tus marcas coincide/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Crear la marca «zzz»/i })).toBeInTheDocument()
  })
})

/**
 * La lista de marcas se carga entera y de una sola vez en el listado de
 * productos. Con veinte o cien no molesta, pero PostgREST corta la respuesta
 * en mil filas y lo hace en silencio: con la lista recortada, el buscador no
 * encontraría una marca que sí existe, ofrecería crearla, y la API la
 * rechazaría con un 409 que nadie entiende. Pasado cierto tamaño, entonces, lo
 * escrito se pregunta contra la base.
 */
describe('cuando hay muchas marcas', () => {
  const MUCHAS = Array.from({ length: 120 }, (_, i) => ({ id: `m${i}`, name: `Marca ${i}` }))

  const montarMuchas = (
    buscar: (query: string, signal?: AbortSignal) => Promise<{ id: string; name: string }[]>,
  ) => {
    const onCreate = vi.fn()
    render(
      <BrandPicker
        brands={MUCHAS}
        totalBrands={1200}
        searchBrands={buscar}
        onSelect={vi.fn()}
        onCreate={onCreate}
      />,
    )
    return { onCreate }
  }

  it('no lista las mil: muestra las primeras y dice que hay más', async () => {
    montarMuchas(async () => [])
    await abrir()

    expect(await screen.findByText(/Tus marcas \(50 de 1200\)/)).toBeInTheDocument()
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(51)
  })

  it('lo escrito se busca contra la base, no contra lo que está cargado', async () => {
    const buscar = vi.fn(async () => [])
    montarMuchas(buscar)
    const buscador = await abrir()

    await userEvent.type(buscador, 'xiaomi')

    await vi.waitFor(() => expect(buscar).toHaveBeenCalled())
    expect(buscar.mock.calls.at(-1)?.[0]).toBe('xiaomi')
  })

  /** El caso que justifica todo esto. */
  it('avisa que ya existe aunque no estuviera en la lista cargada', async () => {
    montarMuchas(async () => [{ id: 'x', name: 'Xiaomi' }])
    const buscador = await abrir()

    await userEvent.type(buscador, 'xiaomi')

    expect(await screen.findByText(/Ya tenés «Xiaomi»/)).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Crear la marca/i })).not.toBeInTheDocument()
  })

  it('mientras pregunta no ofrece crear, para no invitar a duplicar', async () => {
    montarMuchas(() => new Promise(() => {}))
    const buscador = await abrir()

    await userEvent.type(buscador, 'xiaomi')

    expect(await screen.findByText(/Fijándonos si «xiaomi» ya existe/)).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Crear la marca/i })).not.toBeInTheDocument()
  })

  it('si el servidor no la tiene, ahí sí ofrece crearla', async () => {
    montarMuchas(async () => [])
    const buscador = await abrir()

    await userEvent.type(buscador, 'xiaomi')

    expect(await screen.findByRole('option', { name: /Crear la marca «xiaomi»/i })).toBeInTheDocument()
  })

  it('si la búsqueda falla lo dice, en vez de hacer de cuenta que no existe', async () => {
    montarMuchas(async () => { throw new Error('sin red') })
    const buscador = await abrir()

    await userEvent.type(buscador, 'xiaomi')

    expect(await screen.findByText(/No pudimos buscar en el servidor/)).toBeInTheDocument()
  })
})

describe('cuando hay pocas marcas', () => {
  it('no consulta al servidor: la lista cargada ya está completa', async () => {
    const buscar = vi.fn(async () => [])
    render(
      <BrandPicker brands={MARCAS} searchBrands={buscar} onSelect={vi.fn()} onCreate={vi.fn()} />,
    )
    const buscador = await abrir()

    await userEvent.type(buscador, 'sam')
    await new Promise((listo) => setTimeout(listo, 400))

    expect(buscar).not.toHaveBeenCalled()
    expect(screen.getByRole('option', { name: /^Samsung/ })).toBeInTheDocument()
  })
})

/**
 * cmdk marca **todos** los items con `data-disabled="false"`, y la clase de
 * shadcn miraba si el atributo estaba, no su valor: cada opción de cada
 * buscador de la app quedaba al 50 % de opacidad y con `pointer-events: none`.
 * Con el teclado se podía elegir; con el mouse, no. Medido en el navegador:
 * antes `opacity: 0.5, pointer-events: none`; después, `1` y `auto`.
 */
describe('las opciones de los buscadores se pueden clickear', () => {
  it('la clase mira el valor del atributo, no si está', () => {
    const command = leer('src/components/ui/command.tsx')
    expect(command).toContain('data-[disabled=true]:pointer-events-none')
    expect(command).toContain('data-[disabled=true]:opacity-50')
    expect(command).not.toContain('data-[disabled]:pointer-events-none')
  })
})

describe('el formulario de producto y el alta de marca', () => {
  it('el producto usa el buscador de marcas, no la lista sin búsqueda', () => {
    const modal = leer('src/components/dashboard/product-modal.tsx')
    expect(modal).toContain('<BrandPicker')
    expect(modal).not.toContain('placeholder="Seleccionar marca"')
  })

  /** Escribir el nombre dos veces era el paso que sobraba. */
  it('el alta abre con el nombre ya escrito', () => {
    const modal = leer('src/components/dashboard/product-modal.tsx')
    expect(modal).toContain('initialName={nombreDeMarcaNueva}')

    const brandModal = leer('src/components/dashboard/brands/BrandModal.tsx')
    expect(brandModal).toContain('initialName?: string')
    expect(brandModal).toContain("setCatalogQuery(brand ? '' : (initialName ?? '').trim())")
  })

  /** La consulta no tenía tope y PostgREST corta en mil filas sin avisar. */
  it('el listado no se trae las marcas sin tope', () => {
    const hook = leer('src/hooks/useProductsSupabase.ts')
    const marcas = hook.slice(hook.indexOf('const fetchBrands'))
    expect(marcas.slice(0, 600)).toContain('.limit(200)')
  })

  it('crear la marca propia es la acción principal del alta', () => {
    const brandModal = leer('src/components/dashboard/brands/BrandModal.tsx')
    expect(brandModal).toContain('como marca propia')
    expect(brandModal).not.toContain('No está en el catálogo: es una marca propia')
  })
})
