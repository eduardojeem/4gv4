import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/contexts/app-state-context', () => ({
  useAppState: () => ({ state: { cache: {} }, dispatch: vi.fn() }),
}))

import { BranchProvider, useBranch } from '@/contexts/branch-context'

function Mirilla() {
  const { branches, loading } = useBranch()
  return <span data-testid="mirilla">{loading ? 'cargando' : `sucursales:${branches.length}`}</span>
}

const dibujar = () =>
  render(
    <BranchProvider>
      <Mirilla />
    </BranchProvider>
  )

const respuesta = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

describe('las sucursales cuando la sesión ya no vale', () => {
  let errores: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    useAuthMock.mockReturnValue({ user: { id: 'user-1' } })
    errores = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    errores.mockRestore()
  })

  /**
   * El guardia mira el usuario del cliente, que sigue en memoria despues de que
   * el servidor descarto la cookie. Que la sesion venza es normal; no tiene que
   * verse como un bug en la consola.
   */
  it('una sesión vencida se limpia sin gritar en la consola', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(401, { error: 'No autenticado', code: 'AUTH_REQUIRED' })))

    dibujar()

    await waitFor(() => expect(screen.getByTestId('mirilla')).toHaveTextContent('sucursales:0'))
    expect(errores).not.toHaveBeenCalled()
  })

  it('una cuenta inactiva tampoco es un error a gritos', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(403, { error: 'Cuenta inactiva o suspendida' })))

    dibujar()

    await waitFor(() => expect(screen.getByTestId('mirilla')).toHaveTextContent('sucursales:0'))
    expect(errores).not.toHaveBeenCalled()
  })

  /** Una falla de verdad si tiene que quedar registrada. */
  it('un error del servidor sí se registra', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(500, { error: 'Explotó la base' })))

    dibujar()

    await waitFor(() => expect(errores).toHaveBeenCalled())
    expect(screen.getByTestId('mirilla')).toHaveTextContent('sucursales:0')
  })

  it('con sesión buena muestra solo las sucursales activas', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(200, {
      branches: [
        { id: 'b1', name: 'Centro', is_active: true, is_primary: true },
        { id: 'b2', name: 'Cerrada', is_active: false },
      ],
    })))

    dibujar()

    await waitFor(() => expect(screen.getByTestId('mirilla')).toHaveTextContent('sucursales:1'))
    expect(errores).not.toHaveBeenCalled()
  })
})
