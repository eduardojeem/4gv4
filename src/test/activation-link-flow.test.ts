import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: vi.fn(),
      verifyOtp: vi.fn(),
    },
  }),
}))

import { GET } from '@/app/auth/callback/route'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * El correo de activación devolvía a `/auth/callback`, que es del servidor. La
 * sesión de ese correo viaja en el `#`, que el servidor no puede leer: caía en
 * una ruta protegida sin cookie y el proxy mandaba a `/saas`, la portada
 * comercial. La cuenta quedaba confirmada y el dueño no llegaba al onboarding.
 */
describe('el enlace para activar la cuenta', () => {
  it('lleva a la página pública que sabe leer la sesión del enlace', () => {
    const provisioning = leer('src/app/api/auth/register-company/provisioning.ts')
    expect(provisioning).toContain("'/auth/confirm?next=/dashboard/onboarding'")
    expect(provisioning).not.toContain("'/auth/callback?next=/dashboard/onboarding'")
  })

  it('sin token en la URL, el callback no manda a una ruta protegida', async () => {
    const response = await GET(new NextRequest('https://app.test/auth/callback?next=/dashboard/onboarding'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.test/auth/confirm?next=%2Fdashboard%2Fonboarding')
  })

  it('un destino externo no se respeta', async () => {
    const response = await GET(new NextRequest('https://app.test/auth/callback?next=https://malo.test'))

    expect(response.headers.get('location')).toBe('https://app.test/auth/confirm?next=%2Fdashboard')
  })

  /** Con la confirmación pendiente, el ingreso rechaza igual: hay que decirlo. */
  it('después de registrarse se avisa que primero hay que abrir el correo', () => {
    expect(leer('src/app/register/page.tsx')).toContain("'&confirmar=1'")
    // El texto cambio de persona («te mandamos» → «revisá tu correo»), pero
    // sigue saliendo solo cuando el registro dejo la confirmacion pendiente.
    const login = leer('src/app/login/page.tsx')
    expect(login).toContain("searchParams.get('confirmar') === '1'")
    expect(login).toContain('Revisá tu correo para activar la cuenta de ${registeredCompany}')
  })
})
