import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Accordion } from '@/components/ui/accordion'
import { DeviceFilter } from '@/components/public/filters/DeviceFilter'
import { DeviceMenu } from '@/components/public/filters/DeviceMenu'
import { clearAllProductFilters, readActiveProductFilters } from '@/lib/utils/product-filters'

/**
 * En la tienda pública de un taller el cliente busca por su teléfono: llega
 * diciendo «tengo un iPhone 13», no «quiero una pantalla AmpSentrix». El
 * catálogo sólo dejaba filtrar por la marca del repuesto, así que ese cliente
 * tenía que leer 440 nombres de producto para encontrar el suyo.
 *
 * `celular` es la marca del teléfono y `modelo` su modelo; `marca` sigue siendo
 * la marca del repuesto.
 */

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const CATALOGO = leer('src/lib/api/products-server.ts')
const PAGINA = leer('src/app/(public)/productos/page.tsx')

const FACETAS = {
  brands: ['Apple', 'Samsung'],
  modelsByBrand: {
    Apple: ['iPhone 13', 'iPhone 13 Pro Max', 'iPhone 16 Pro'],
    Samsung: ['A15'],
  },
}

const abrirFiltro = (props: Partial<React.ComponentProps<typeof DeviceFilter>> = {}) => {
  const onChange = vi.fn()
  render(
    <Accordion type="multiple" defaultValue={['device']}>
      <DeviceFilter facets={FACETAS} selectedBrand="" selectedModel="" onChange={onChange} {...props} />
    </Accordion>
  )
  return onChange
}

const abrirMenu = async (props: Partial<React.ComponentProps<typeof DeviceMenu>> = {}) => {
  const onSelect = vi.fn()
  render(<DeviceMenu facets={FACETAS} selectedBrand="" selectedModel="" onSelect={onSelect} {...props} />)
  await userEvent.click(screen.getByRole('button'))
  return onSelect
}

describe('el filtro por celular de la tienda publica', () => {
  it('no se muestra en una tienda que no carga celulares', () => {
    abrirFiltro({ facets: { brands: [], modelsByBrand: {} } })
    expect(screen.queryByText('Tu celular')).not.toBeInTheDocument()
  })

  it('el boton dice que celular esta elegido, sin abrir nada', () => {
    render(
      <DeviceMenu facets={FACETAS} selectedBrand="Apple" selectedModel="iPhone 13" onSelect={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /Apple iPhone 13/ })).toBeInTheDocument()
  })

  it('el menu lista las marcas con cuantos modelos tiene cada una', async () => {
    await abrirMenu()
    // Submenu: la marca no filtra al tocarla, abre sus modelos.
    const apple = screen.getByRole('menuitem', { name: /Apple/ })
    expect(apple).toHaveAttribute('aria-haspopup', 'menu')
    expect(apple).toHaveTextContent('3')
    expect(screen.getByRole('menuitem', { name: /Samsung/ })).toHaveTextContent('1')
  })

  it('«Todos los celulares» quita marca y modelo de una vez', async () => {
    const onSelect = await abrirMenu({ selectedBrand: 'Apple', selectedModel: 'iPhone 13' })
    await userEvent.click(screen.getByRole('menuitem', { name: /Todos los celulares/ }))
    expect(onSelect).toHaveBeenCalledWith({ celular: null, modelo: null })
  })

  it('una marca sin modelos cargados filtra sola, sin submenu', async () => {
    const onSelect = await abrirMenu({
      facets: { brands: ['Motorola'], modelsByBrand: {} },
    })
    const motorola = screen.getByRole('menuitem', { name: /Motorola/ })
    expect(motorola).not.toHaveAttribute('aria-haspopup')
    await userEvent.click(motorola)
    expect(onSelect).toHaveBeenCalledWith({ celular: 'Motorola', modelo: null })
  })

  it('el submenu de la marca ofrece sus modelos y los aplica con la marca', async () => {
    const onSelect = await abrirMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: /Apple/ }))

    expect(await screen.findByText('Modelos de Apple')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('menuitem', { name: /^iPhone 13 Pro Max/ }))
    // Siempre viaja la marca: elegir un modelo no puede dejar el filtro a medias.
    expect(onSelect).toHaveBeenCalledWith({ celular: 'Apple', modelo: 'iPhone 13 Pro Max' })
  })

  it('«Todos los Apple» deja la marca y limpia el modelo', async () => {
    const onSelect = await abrirMenu({ selectedBrand: 'Apple', selectedModel: 'iPhone 13' })
    await userEvent.click(screen.getByRole('menuitem', { name: /Apple/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Todos los Apple/ }))
    expect(onSelect).toHaveBeenCalledWith({ celular: 'Apple', modelo: null })
  })

  it('volver a tocar el modelo activo lo quita', async () => {
    const onSelect = await abrirMenu({ selectedBrand: 'Samsung', selectedModel: 'A15' })
    await userEvent.click(screen.getByRole('menuitem', { name: /Samsung/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /^A15/ }))
    expect(onSelect).toHaveBeenCalledWith({ celular: 'Samsung', modelo: null })
  })

  it('con algo elegido aparece como quitarlo', async () => {
    const onSelect = await abrirMenu({ selectedBrand: 'Apple', selectedModel: '' })
    await userEvent.click(screen.getByRole('menuitem', { name: /Quitar el filtro de celular/ }))
    expect(onSelect).toHaveBeenCalledWith({ celular: null, modelo: null })
  })
})

describe('el filtro viaja en la URL', () => {
  it('se lee de un enlace compartido y cuenta como filtro activo', () => {
    const params = new URLSearchParams('celular=Apple&modelo=iPhone+13&sort=device')
    expect(readActiveProductFilters(params)).toMatchObject({
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13',
      hasActiveFilters: true,
    })
  })

  it('«Limpiar todos» también lo borra, y conserva el orden', () => {
    const params = new URLSearchParams('celular=Apple&modelo=iPhone+13&sort=device')
    expect(clearAllProductFilters(params).toString()).toBe('sort=device&page=1')
  })
})

describe('la consulta pública', () => {
  it('filtra por la marca del celular y busca el modelo entre los compatibles', () => {
    // `device_models` es un text[]: una pantalla «iPhone 12 / 12 Pro» tiene que
    // aparecer con cualquiera de los dos modelos.
    expect(CATALOGO).toContain("q.eq('device_brand', deviceBrand)")
    expect(CATALOGO).toContain("q.contains('device_models', [deviceModel])")
  })

  it('normaliza lo que llega por la URL, como al guardar el producto', () => {
    expect(CATALOGO).toContain('normalizeDeviceBrand(sanitizeFilterTerm(rawDeviceBrand')
    expect(CATALOGO).toContain('normalizeDeviceModel(sanitizeFilterTerm(rawDeviceModel')
  })

  it('no toca las columnas si falta la migración: la tienda no puede quedarse sin catálogo', () => {
    expect(CATALOGO).toContain('productsHaveDeviceColumns(supabase)')
    expect(CATALOGO).toContain("conCelular ? ', device_brand, device_models' : ''")
    expect(CATALOGO).toContain('if (conCelular && deviceBrand)')
    expect(CATALOGO).toContain('if (conCelular && deviceModel)')
  })

  it('ordena por celular con los productos sin cargar al final', () => {
    expect(CATALOGO).toContain("'discount_desc', 'featured', 'default', 'device'")
    expect(CATALOGO).toContain("q.order('device_sort_key', { ascending: true, nullsFirst: false })")
  })

  it('las facetas sólo listan celulares con algún producto publicado', () => {
    expect(CATALOGO).toContain("await supabase\n    .from('products')\n    .select('device_brand, device_models')")
    expect(CATALOGO).toContain(".not('device_brand', 'is', null)")
    // Misma etiqueta de caché que las marcas: publicar un producto refresca las dos.
    expect(CATALOGO).toContain('tags: [`product-facets:${organizationId}`]')
  })

  it('el menu vive arriba, junto al orden, y no dentro de la franja que se desplaza', () => {
    const BARRA = leer('src/app/(public)/productos/components/StoreContextFilterBar.tsx')
    expect(BARRA).not.toContain('DeviceMenu')
    expect(BARRA).not.toContain('deviceFacets')

    const SELECTOR = leer('src/app/(public)/productos/components/DeviceSelect.tsx')
    expect(SELECTOR).toContain('<DeviceMenu')
    // El orden en la fila: celular, sucursal, relevancia.
    expect(PAGINA.indexOf('<DeviceSelect')).toBeLessThan(PAGINA.indexOf('<BranchSelect'))
    expect(PAGINA.indexOf('<BranchSelect')).toBeLessThan(PAGINA.indexOf('<ProductSort'))
  })

  it('la página pasa el celular a la consulta y las opciones a los filtros', () => {
    expect(PAGINA).toContain('deviceBrand,\n      deviceModel,')
    expect(PAGINA).toContain('deviceFacets={deviceFacets}')
    expect(PAGINA).toContain('showDeviceSort={deviceFacets.brands.length > 0}')
  })
})
