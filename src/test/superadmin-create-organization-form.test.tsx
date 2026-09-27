import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CreateOrganizationForm } from '@/components/superadmin/organizations/CreateOrganizationForm'
import type { OwnerLookup, OwnerOutcome, PlanOption } from '@/lib/superadmin/create-organization'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const PLANES: PlanOption[] = [
  {
    code: 'FREE', name: 'Free', price: 0, priceNote: null, description: null, isPopular: false,
    trialDays: 0, limits: { users: 2, branches: 1, products: 50 }, limitsSource: 'technical', moduleCount: 5,
  },
  {
    code: 'PRO', name: 'Pro', price: 250_000, priceNote: null, description: null, isPopular: true,
    trialDays: 14, limits: { users: 15, branches: null }, limitsSource: 'technical', moduleCount: 12,
  },
]

type Respuestas = {
  slug?: { status?: number; body?: unknown }
  owner?: { status?: number; body?: OwnerLookup }
  crear?: { status?: number; body?: unknown }
  asignar?: { status?: number; body?: { owner: OwnerOutcome } }
}

const respuesta = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body })

function simularApi(r: Respuestas = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url)
    if (u.includes('?slug=')) {
      const slug = decodeURIComponent(u.split('?slug=')[1])
      return respuesta(r.slug?.status ?? 200, r.slug?.body ?? { slug, available: true })
    }
    if (u.includes('?owner_email=')) {
      const email = decodeURIComponent(u.split('?owner_email=')[1])
      return respuesta(r.owner?.status ?? 200, r.owner?.body ?? {
        email, exists: false, suspended: false, superAdmin: false, organizations: 0, lookupIncomplete: false,
      })
    }
    if (u.endsWith('/owner') && init?.method === 'POST') {
      return respuesta(r.asignar?.status ?? 200, r.asignar?.body ?? { owner: { status: 'invited', email: 'x@y.com' } })
    }
    if (init?.method === 'POST') {
      return respuesta(r.crear?.status ?? 201, r.crear?.body ?? {})
    }
    throw new Error(`fetch inesperado: ${u}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const pintar = () => render(<CreateOrganizationForm plans={PLANES} plansFailed={false} />)

beforeEach(() => {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn() } })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('la dirección de la tienda', () => {
  it('se genera desde el nombre y se verifica', async () => {
    simularApi()
    const u = userEvent.setup()
    pintar()
    await u.type(screen.getByLabelText(/^Nombre de la empresa/), 'HCA Celular')
    expect(screen.getByLabelText(/Dirección de la tienda/)).toHaveValue('hca-celular')
    expect(await screen.findByText('Disponible')).toBeInTheDocument()
  })

  it('una reservada se rechaza sin consultar la red y ofrece una alternativa', async () => {
    const api = simularApi()
    const u = userEvent.setup()
    pintar()
    await u.type(screen.getByLabelText(/^Nombre de la empresa/), 'Marketplace')

    expect(screen.getByText(/reservada por el sistema/)).toBeInTheDocument()
    expect(api.mock.calls.some((c) => String(c[0]).includes('?slug='))).toBe(false)

    await u.click(screen.getByRole('button', { name: /Usar «marketplace-tienda»/ }))
    expect(screen.getByLabelText(/Dirección de la tienda/)).toHaveValue('marketplace-tienda')
  })

  it('una consulta caída no se muestra como disponible', async () => {
    simularApi({ slug: { status: 503, body: { error: 'x' } } })
    const u = userEvent.setup()
    pintar()
    await u.type(screen.getByLabelText(/^Nombre de la empresa/), 'HCA Celular')
    expect(await screen.findByText(/No se pudo verificar\. Se confirma al crear/)).toBeInTheDocument()
    expect(screen.queryByText('Disponible')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Crear organización/ })).toBeDisabled()
  })

  it('se puede escribir un guion a mano', async () => {
    simularApi()
    const u = userEvent.setup()
    pintar()
    await u.type(screen.getByLabelText(/Dirección de la tienda/), 'mi-')
    expect(screen.getByLabelText(/Dirección de la tienda/)).toHaveValue('mi-')
  })
})

describe('los planes muestran los topes que se aplican', () => {
  it('distingue «sin tope» de «no definido» y dice cuando no hay prueba', () => {
    simularApi()
    pintar()
    const pro = screen.getByRole('radio', { name: /^Plan Pro,/ })
    expect(pro).toHaveTextContent('Sin tope')
    expect(pro).toHaveTextContent('No definido')
    expect(screen.getByRole('radio', { name: /^Plan Free,/ })).toHaveTextContent('Sin prueba')
  })

  it('arranca en FREE', () => {
    simularApi()
    pintar()
    expect(screen.getByRole('radio', { name: /^Plan Free,/ })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('el propietario', () => {
  it('sin correo avisa que nadie va a poder entrar', () => {
    simularApi()
    pintar()
    expect(screen.getByText(/nadie puede entrar a esta organización/)).toBeInTheDocument()
  })

  it('con cuenta existente dice que no se envía correo, y si es superadmin que conserva su acceso', async () => {
    simularApi({
      owner: {
        body: {
          email: 'dueno@hca.com.py', exists: true, suspended: false, superAdmin: true,
          organizations: 1, lookupIncomplete: false,
        },
      },
    })
    const u = userEvent.setup()
    pintar()
    await u.type(screen.getByLabelText('Correo del propietario'), 'dueno@hca.com.py')
    expect(await screen.findByText(/Ya tiene una cuenta/)).toBeInTheDocument()
    expect(screen.getByText(/sin enviar correo/, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(/conserva su acceso a este panel/)).toBeInTheDocument()
  })

  it('una cuenta suspendida bloquea el alta y dice por qué', async () => {
    simularApi({
      owner: {
        body: {
          email: 's@hca.com.py', exists: true, suspended: true, superAdmin: false,
          organizations: 0, lookupIncomplete: false,
        },
      },
    })
    const u = userEvent.setup()
    pintar()
    await u.type(screen.getByLabelText(/^Nombre de la empresa/), 'HCA Celular')
    await u.type(screen.getByLabelText('Correo del propietario'), 's@hca.com.py')
    expect(await screen.findByText(/Esta cuenta está suspendida/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('La cuenta del propietario está suspendida.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Crear organización/ })).toBeDisabled()
  })
})

describe('la vista previa dice lo que realmente se crea', () => {
  it('sin promesas falsas', () => {
    // La anterior prometia un «esquema de base de datos aislado», una sucursal
    // «Casa Central» y «catálogo y POS listos para operar».
    simularApi()
    pintar()
    const texto = document.body.textContent ?? ''
    expect(texto).not.toMatch(/aislado/i)
    expect(texto).not.toContain('Casa Central')
    expect(texto).not.toMatch(/listos para operar/i)
    expect(texto).toContain('«Sucursal principal»')
    expect(texto).toContain('Tienda pública sin publicar')
    expect(texto).toContain('Configuración inicial pendiente')
  })
})

describe('después de crear', () => {
  const creada = (owner: OwnerOutcome) => ({
    success: true,
    organization: { id: 'org-1', name: 'HCA Celular', slug: 'hca-celular', plan: 'FREE' },
    subscription: { status: 'trialing', trialDays: 0, trialEndsAt: '2026-09-10T00:00:00Z' },
    owner,
  })

  async function crear(respuestas: Respuestas) {
    simularApi(respuestas)
    const u = userEvent.setup()
    pintar()
    await u.type(screen.getByLabelText(/^Nombre de la empresa/), 'HCA Celular')
    await screen.findByText('Disponible')
    await u.click(screen.getByRole('button', { name: /Crear organización/ }))
    return u
  }

  it('no dice «activa y lista para operar»: dice que falta configurar y publicar', async () => {
    await crear({ crear: { body: creada({ status: 'none' }) } })
    expect(await screen.findByText('Organización creada')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/lista para operar/i)
    expect(screen.getByText(/Configuración inicial pendiente/)).toBeInTheDocument()
    expect(screen.getByText(/todavía no está publicada/)).toBeInTheDocument()
  })

  it('lleva al expediente de la organización creada', async () => {
    await crear({ crear: { body: creada({ status: 'none' }) } })
    expect(await screen.findByRole('link', { name: /Ver expediente/ })).toHaveAttribute(
      'href',
      '/superadmin/organizations/hca-celular'
    )
  })

  it('si el propietario falló, se puede reintentar ahí mismo', async () => {
    // Antes la pantalla mostraba el error y no ofrecía nada: la organización
    // quedaba sin nadie que pudiera entrar y sin desde dónde corregirlo.
    const u = await crear({
      crear: {
        body: creada({
          status: 'failed', email: 'nuevo@hca.com.py', reason: 'invite_failed',
          message: 'No se pudo enviar la invitación.',
        }),
      },
      asignar: { body: { owner: { status: 'invited', email: 'otro@hca.com.py' } } },
    })

    expect(await screen.findByText(/No se pudo asignar a nuevo@hca\.com\.py/)).toBeInTheDocument()
    await u.type(screen.getByLabelText('Correo del propietario'), 'otro@hca.com.py')
    await u.click(screen.getByRole('button', { name: /Asignar propietario/ }))
    expect(await screen.findByText(/Se envió una invitación a/)).toBeInTheDocument()
  })

  it('con una cuenta existente avisa que no se le mandó correo', async () => {
    await crear({ crear: { body: creada({ status: 'assigned_existing', email: 'dueno@hca.com.py' }) } })
    expect(await screen.findByText(/No se le envió correo/)).toBeInTheDocument()
  })

  it('un error sobre un campo se muestra debajo de ese campo', async () => {
    await crear({ crear: { status: 409, body: { error: 'La dirección «hca-celular» ya está en uso.', field: 'slug' } } })
    expect(await screen.findByText('La dirección «hca-celular» ya está en uso.')).toBeInTheDocument()
    expect(screen.queryByText('Organización creada')).not.toBeInTheDocument()
  })

  it('«Crear otra» vuelve al formulario vacío', async () => {
    const u = await crear({ crear: { body: creada({ status: 'none' }) } })
    await u.click(await screen.findByRole('button', { name: /Crear otra/ }))
    expect(screen.getByLabelText(/^Nombre de la empresa/)).toHaveValue('')
  })
})

/**
 * La fecha de fin de prueba se formateaba sin zona horaria: el servidor usaba
 * la suya (UTC en produccion) y el navegador la del usuario. Entre las 21:00 y
 * las 24:00 de Paraguay el HTML del servidor traia el dia siguiente.
 */
describe('las fechas no dependen de la zona del servidor', () => {
  it('se formatean en la zona horaria elegida para la organización', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const fuente = readFileSync(
      resolve(process.cwd(), 'src/components/superadmin/organizations/CreateOrganizationForm.tsx'),
      'utf8'
    )
    expect(fuente).toContain("year: 'numeric', timeZone }")
    expect(fuente).toContain('formatDate(trialEndDate(planElegido.trialDays), timezone)')
    expect(fuente).toContain('formatDate(subscription.trialEndsAt, timezone)')
  })
})
