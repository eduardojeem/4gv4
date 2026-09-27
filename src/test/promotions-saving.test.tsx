import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useSWR, { SWRConfig, mutate as mutateGlobal, useSWRConfig } from 'swr'
import { usePromotions } from '@/hooks/use-promotions'

/**
 * Guardar una promoción no se veía en pantalla hasta recargar la página.
 *
 * El hook guardaba y después pedía la lista entera de nuevo: hasta que esa
 * segunda consulta volvía, la pantalla mostraba lo viejo, y como se ponía en
 * «cargando», la lista desaparecía y volvía a aparecer. Si esa consulta la
 * respondía una copia guardada —el service worker guardaba cada GET a /api
 * durante 24 horas— el cambio no aparecía nunca.
 */

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const PROMO = {
  id: 'p1',
  code: 'VERANO',
  name: 'Verano',
  description: '',
  type: 'percentage',
  value: 10,
  is_active: true,
  usage_count: 0,
  usage_limit: null,
  start_date: null,
  end_date: null,
  public_mode: 'disabled',
}

/** Respuestas encoladas para cada llamada a fetch, en orden. */
function servidor(respuestas: Array<{ ok?: boolean; body: unknown }>) {
  const llamadas: Array<{ url: string; method: string }> = []
  const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
    llamadas.push({ url: String(url), method: init?.method ?? 'GET' })
    const siguiente = respuestas.shift() ?? { body: { promotions: [] } }
    return {
      ok: siguiente.ok !== false,
      json: async () => siguiente.body,
    } as Response
  })
  vi.stubGlobal('fetch', fetchFalso)
  return { llamadas }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const montar = async () => {
  const hook = renderHook(() => usePromotions())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('guardar una promoción se ve en el acto', () => {
  it('editar deja el cambio en la lista sin pedirla de nuevo', async () => {
    const { llamadas } = servidor([
      { body: { promotions: [PROMO] } },
      { body: { ...PROMO, name: 'Verano 2026', value: 25 } },
    ])
    const { result } = await montar()

    await act(async () => {
      await result.current.updatePromotion('p1', { name: 'Verano 2026' })
    })

    expect(result.current.promotions[0].name).toBe('Verano 2026')
    expect(result.current.promotions[0].value).toBe(25)
    // La carga inicial y el PUT. Nada más: la respuesta ya traía la promoción.
    expect(llamadas.map((l) => l.method)).toEqual(['GET', 'PUT'])
  })

  /**
   * Es el caso que obligaba a recargar: una consulta que contesta lo viejo no
   * puede borrar de la pantalla lo que se acaba de guardar.
   */
  it('una lista vieja del servidor no pisa lo recién guardado', async () => {
    servidor([
      { body: { promotions: [PROMO] } },
      { body: { ...PROMO, name: 'Verano 2026' } },
    ])
    const { result } = await montar()

    await act(async () => {
      await result.current.updatePromotion('p1', { name: 'Verano 2026' })
    })
    // Pasa el tiempo por si quedó alguna consulta de fondo encolada.
    await act(async () => { await new Promise((listo) => setTimeout(listo, 50)) })

    expect(result.current.promotions[0].name).toBe('Verano 2026')
  })

  it('crear pone la promoción arriba de la lista', async () => {
    servidor([
      { body: { promotions: [PROMO] } },
      { body: { ...PROMO, id: 'p2', name: 'Invierno', code: 'INVIERNO' } },
    ])
    const { result } = await montar()

    await act(async () => {
      await result.current.createPromotion({ name: 'Invierno' } as never)
    })

    expect(result.current.promotions.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('activar y desactivar cambia el estado al toque', async () => {
    servidor([
      { body: { promotions: [PROMO] } },
      { body: { ...PROMO, is_active: false } },
    ])
    const { result } = await montar()

    await act(async () => {
      await result.current.togglePromotionStatus('p1', true)
    })

    expect(result.current.promotions[0].is_active).toBe(false)
  })

  it('borrar saca la promoción de la lista', async () => {
    servidor([
      { body: { promotions: [PROMO] } },
      { body: { success: true } },
    ])
    const { result } = await montar()

    await act(async () => {
      await result.current.deletePromotion('p1')
    })

    expect(result.current.promotions).toHaveLength(0)
  })

  /** Si falla, la lista tiene que quedar como estaba. */
  it('un error no toca la lista', async () => {
    servidor([
      { body: { promotions: [PROMO] } },
      { ok: false, body: { error: 'Ya existe una promoción con ese código' } },
    ])
    const { result } = await montar()

    await act(async () => {
      const guardado = await result.current.updatePromotion('p1', { name: 'Otro' })
      expect(guardado).toBe(false)
    })

    expect(result.current.promotions[0].name).toBe('Verano')
  })

  it('la lista no se vacía mientras se guarda', async () => {
    servidor([
      { body: { promotions: [PROMO] } },
      { body: { ...PROMO, name: 'Verano 2026' } },
    ])
    const { result } = await montar()

    await act(async () => {
      await result.current.updatePromotion('p1', { name: 'Verano 2026' })
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.promotions).toHaveLength(1)
  })
})

/**
 * La app envuelve todo en `SWRConfig` con un proveedor de caché propio. Con un
 * proveedor propio, el `mutate` importado de 'swr' escribe en la caché por
 * defecto, que no es la que leen los componentes: los ajustes de la pestaña
 * pública se guardaban bien en el servidor y la pantalla no se enteraba.
 */
describe('mutate y el proveedor de caché propio de la app', () => {
  function Lectora() {
    const { data } = useSWR('/clave', async () => 'del servidor', { revalidateOnMount: false })
    const { mutate: ligado } = useSWRConfig()
    return (
      <div>
        <span data-testid="valor">{String(data)}</span>
        <button onClick={() => void ligado('/clave', 'ligado', false)}>ligado</button>
      </div>
    )
  }

  const conProveedorPropio = () =>
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Lectora />
      </SWRConfig>,
    )

  it('el mutate global no llega a la caché que leen los componentes', async () => {
    conProveedorPropio()
    await act(async () => {
      screen.getByText('ligado').click()
    })
    expect(screen.getByTestId('valor').textContent).toBe('ligado')

    await act(async () => {
      await mutateGlobal('/clave', 'global', false)
    })
    // Sigue mostrando lo del ligado: el global escribió en otra caché.
    expect(screen.getByTestId('valor').textContent).toBe('ligado')
  })

  it('los ajustes del sitio usan el mutate ligado', () => {
    const hook = leer('src/hooks/useWebsiteSettings.ts')
    expect(hook).toContain("import useSWR, { useSWRConfig } from 'swr'")
    expect(hook).toContain('const { mutate: mutateCache } = useSWRConfig()')
    expect(hook).not.toMatch(/\bawait mutate\(/)
  })
})

/**
 * El service worker guardaba en la caché `apis` la respuesta de cualquier GET a
 * /api/ durante 24 horas, y con la red lenta la servía como si fuera actual.
 */
describe('el service worker y las respuestas de la API', () => {
  const config = leer('next.config.ts')

  it('las llamadas a la API no se guardan en la caché del service worker', () => {
    expect(config).toContain("handler: 'NetworkOnly' as const")
    expect(config).toContain("cacheName: 'apis'")
    expect(config).toContain('extendDefaultRuntimeCaching: true')
  })

  /**
   * `resolveRuntimeCaching` en @ducanh2912/next-pwa conserva las reglas por
   * defecto y descarta sólo la que comparte `cacheName` con una propia, así que
   * fuentes, imágenes y estáticos se siguen guardando.
   */
  it('reemplaza sólo la regla de la API, no todas', () => {
    const reglas = config.slice(config.indexOf('runtimeCaching'), config.indexOf('extendDefault') + 400)
    expect((config.match(/handler: /g) ?? []).length).toBe(1)
    expect(reglas).not.toContain('CacheFirst')
  })
})
