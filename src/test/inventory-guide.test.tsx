import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { InventoryGuide } from '@/components/admin/inventory/InventoryGuide'

const PANTALLA = readFileSync(
  resolve(process.cwd(), 'src/components/admin/inventory/inventory-management.tsx'),
  'utf8'
)

const abrirGuia = async () => {
  const usuario = userEvent.setup()
  render(<InventoryGuide />)
  await usuario.click(screen.getByRole('button', { name: /Ver guía/ }))
  return usuario
}

beforeEach(() => window.localStorage.clear())

/**
 * La guia anterior eran tres frases de una linea, siempre plegada y sin memoria:
 * quien la necesitaba la abria en cada visita y no encontraba nada accionable.
 */
describe('la guia se abre y se acuerda', () => {
  it('arranca plegada y no ocupa la pantalla', () => {
    render(<InventoryGuide />)
    expect(screen.getByRole('button', { name: /Ver guía/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/El catálogo es uno/)).not.toBeInTheDocument()
  })

  it('recuerda que la dejaste abierta', async () => {
    await abrirGuia()
    expect(window.localStorage.getItem('mipos:inventory:guide-open')).toBe('true')
  })

  it('el almacenamiento bloqueado no rompe la pantalla', () => {
    // Ventana privada: la guia vuelve a arrancar plegada, nada mas.
    const original = window.localStorage.getItem
    Object.defineProperty(window.localStorage, 'getItem', {
      value: () => { throw new Error('bloqueado') },
      configurable: true,
    })
    expect(() => render(<InventoryGuide />)).not.toThrow()
    Object.defineProperty(window.localStorage, 'getItem', { value: original, configurable: true })
  })
})

describe('explica el modelo de stock con numeros', () => {
  it('separa el catalogo compartido de las existencias por sucursal', async () => {
    await abrirGuia()
    expect(screen.getByText(/El catálogo es uno; las existencias son de cada sucursal/)).toBeInTheDocument()
    expect(screen.getByText(/una sola vez/)).toBeInTheDocument()
    // El ejemplo muestra el mismo producto con stock distinto en cada sucursal.
    expect(screen.getByText('Sucursal Centro')).toBeInTheDocument()
    expect(screen.getByText('12 unidades')).toBeInTheDocument()
    expect(screen.getByText('Depósito')).toBeInTheDocument()
    expect(screen.getByText('40 unidades')).toBeInTheDocument()
  })

  it('avisa de la confusion mas frecuente: mirar la sucursal equivocada', async () => {
    await abrirGuia()
    expect(screen.getByText(/mirá la insignia de sucursal/)).toBeInTheDocument()
  })
})

describe('los cuatro movimientos, con el numero moviendose', () => {
  it('cada uno tiene su ejemplo trabajado', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Los cuatro movimientos/ }))

    expect(screen.getByText('Entrada · llegó mercadería')).toBeInTheDocument()
    expect(screen.getByText('Centro pasa de 12 a')).toBeInTheDocument()
    expect(screen.getByText('Salida · se fue sin venderse')).toBeInTheDocument()
    expect(screen.getByText('Transferencia · de una sucursal a otra')).toBeInTheDocument()
  })

  it('deja claro que el ajuste define y no suma', async () => {
    // Es el campo donde mas gente se equivoca: pone 2 queriendo sacar 2.
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Los cuatro movimientos/ }))
    expect(screen.getByText(/no suma ni\s+resta/)).toBeInTheDocument()
    expect(screen.getByText('Ingresás el stock final')).toBeInTheDocument()
  })

  it('la transferencia muestra las dos puntas', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Los cuatro movimientos/ }))
    expect(screen.getByText('Depósito pasa de 40 a')).toBeInTheDocument()
    expect(screen.getByText('Centro pasa de 28 a')).toBeInTheDocument()
  })

  it('dice que la venta se registra sola', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Los cuatro movimientos/ }))
    expect(screen.getByText(/Las ventas no se cargan a mano/)).toBeInTheDocument()
  })
})

describe('explica las etiquetas de stock, incluido el maximo vacio', () => {
  it('los dos casos que se confunden llevan sus numeros', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Qué significa cada etiqueta/ }))

    // El ejemplo existe justamente porque «con 50 unidades» da distinto segun
    // haya o no un maximo cargado: aparece dos veces, con dos resultados.
    expect(screen.getByText('Mínimo 5, máximo sin cargar:')).toBeInTheDocument()
    expect(screen.getByText('Mínimo 5, máximo 40:')).toBeInTheDocument()

    const filas = screen.getAllByText('con 50 unidades')
    expect(filas).toHaveLength(2)
    const resultados = filas.map((fila) => fila.parentElement?.textContent?.replace('con 50 unidades', ''))
    expect(resultados).toEqual(['Normal', 'Alto'])

    expect(screen.getByText(/sin techo/)).toBeInTheDocument()
  })

  it('menciona que el minimo puede ser propio de la sucursal', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Qué significa cada etiqueta/ }))
    expect(screen.getByText(/depósito y un kiosco no necesitan el mismo/)).toBeInTheDocument()
  })
})

describe('explica el alcance de los indicadores', () => {
  it('dice que no son de la pagina que estas viendo', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Cómo leer los indicadores/ }))
    expect(screen.getByText(/todo el catálogo/)).toBeInTheDocument()
  })

  it('muestra de donde sale «Valor a costo»', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Cómo leer los indicadores/ }))
    // 30 x 28.000 + 4 x 15.000 = 900.000
    expect(screen.getByText('840.000 Gs')).toBeInTheDocument()
    expect(screen.getByText('60.000 Gs')).toBeInTheDocument()
    expect(screen.getByText('900.000 Gs')).toBeInTheDocument()
  })

  it('aclara que «Sin datos» no es cero', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Cómo leer los indicadores/ }))
    expect(screen.getByText(/No es cero: es que no se sabe/)).toBeInTheDocument()
  })
})

describe('responde las preguntas que la gente hace', () => {
  it('incluye la mas comun de todas', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Situaciones comunes/ }))
    expect(screen.getByText('«Vendí y el stock no bajó»')).toBeInTheDocument()
    expect(screen.getByText(/Fijate en qué sucursal estás parado/)).toBeInTheDocument()
  })

  it('explica el aviso de stock cambiado', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Situaciones comunes/ }))
    expect(screen.getByText('«Me dice que el stock cambió mientras cargaba»')).toBeInTheDocument()
  })

  it('avisa por que los movimientos viejos estan en la sucursal principal', async () => {
    // Consecuencia del backfill: la sucursal real nunca se habia guardado.
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Situaciones comunes/ }))
    expect(screen.getByText(/quedaron en la principal/)).toBeInTheDocument()
  })
})

describe('describe las diez secciones', () => {
  it('separa lo del dia a dia de lo que se configura', async () => {
    const usuario = await abrirGuia()
    await usuario.click(screen.getByRole('button', { name: /Qué hace cada sección/ }))
    expect(screen.getByText(/Operación · el día a día/)).toBeInTheDocument()
    expect(screen.getByText(/Gestión · se configura de vez en cuando/)).toBeInTheDocument()
    expect(screen.getByText('Stock por sucursal')).toBeInTheDocument()
    expect(screen.getByText('Búsqueda avanzada')).toBeInTheDocument()
  })
})

describe('la pantalla usa esta guia y no la vieja', () => {
  it('reemplaza al bloque de tres frases', () => {
    expect(PANTALLA).toContain('<InventoryGuide />')
    expect(PANTALLA).not.toContain('¿Cómo funciona la Gestión de Inventario?')
    expect(PANTALLA).not.toContain('Mostrar guía ↓')
  })
})
