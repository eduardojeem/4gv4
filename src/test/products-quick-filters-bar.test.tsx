import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuickFiltersBar, type QuickFilterCounts } from '@/components/dashboard/products-modern/QuickFiltersBar'

/**
 * La barra eran ocho botones en fila, cada uno de un color distinto y con su
 * badge del mismo tono. Nada decía cuáles se excluían entre sí ni cuál estaba
 * puesto: el alcance de la pantalla («solo productos activos») no se veía por
 * ningún lado. Ahora son tres grupos rotulados y el que está activo se marca.
 */

const conteos: QuickFilterCounts = {
  all: 351,
  products: 340,
  services: 11,
  variants: 8,
  low_stock: 12,
  out_of_stock: 3,
  active: 347,
  inactive: 4,
}

const montar = (props: Partial<React.ComponentProps<typeof QuickFiltersBar>> = {}) => {
  const onFilterClick = vi.fn()
  const { unmount } = render(
    <QuickFiltersBar products={[]} counts={conteos} onFilterClick={onFilterClick} {...props} />,
  )
  return { onFilterClick, unmount }
}

// El nombre accesible del chip incluye el conteo («Activos 347»), y «Activos»
// esta adentro de «Inactivos»: se ancla al principio.
const chip = (nombre: string) => screen.getByRole('button', { name: new RegExp(`^${nombre}`, 'i') })

describe('la barra de filtros del listado', () => {
  it('separa el tipo, el estado y las alertas', () => {
    montar()
    expect(screen.getByText('Tipo')).toBeInTheDocument()
    expect(screen.getByText('Estado')).toBeInTheDocument()
    expect(screen.getByText('Alertas')).toBeInTheDocument()
  })

  /** Lo que el usuario necesita saber: qué está recortando la lista. */
  it('marca el alcance con el que abre la sección', () => {
    montar({ catalogKind: 'part', isActive: true })

    expect(chip('Productos')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Activos')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Servicios')).toHaveAttribute('aria-pressed', 'false')
    expect(chip('Inactivos')).toHaveAttribute('aria-pressed', 'false')
  })

  it('un filtro de alerta no apaga la marca del alcance', () => {
    montar({ catalogKind: 'part', isActive: true, activeFilter: 'low_stock' })

    expect(chip('Bajo stock')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Productos')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Activos')).toHaveAttribute('aria-pressed', 'true')
  })

  it('cada filtro muestra cuántos hay', () => {
    montar({ catalogKind: 'part' })
    expect(within(chip('Productos')).getByText('340')).toBeInTheDocument()
    expect(within(chip('Agotados')).getByText('3')).toBeInTheDocument()
    expect(within(chip('Inactivos')).getByText('4')).toBeInTheDocument()
  })

  it('avisa cómo salir al catálogo completo solo cuando algo está filtrando', () => {
    const { unmount } = montar()
    expect(screen.queryByRole('button', { name: /Todo el catálogo/i })).not.toBeInTheDocument()
    unmount()

    montar({ catalogKind: 'part' })
    expect(screen.getByRole('button', { name: /Todo el catálogo/i })).toBeInTheDocument()
  })

  it('pide el filtro que se tocó', async () => {
    const { onFilterClick } = montar({ catalogKind: 'part' })

    await userEvent.click(chip('Agotados'))
    expect(onFilterClick).toHaveBeenCalledWith('out_of_stock')

    await userEvent.click(screen.getByRole('button', { name: /Todo el catálogo/i }))
    expect(onFilterClick).toHaveBeenCalledWith('all')
  })

  /** Las pantallas viejas pasan solo `activeFilter`: tienen que seguir andando. */
  it('entiende el filtro rápido viejo', () => {
    montar({ activeFilter: 'services' })
    expect(chip('Servicios')).toHaveAttribute('aria-pressed', 'true')
  })
})
