import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SuperAdminsManager, type SuperAdminRow } from '@/components/superadmin/SuperAdminsManager'
import { findAuthUserByEmail } from '@/lib/superadmin/find-auth-user'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const RUTA_API = leer('src/app/api/superadmin/super-admins/route.ts')
const PAGINA = leer('src/app/superadmin/users/super-admins/page.tsx')

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

const dias = (n: number) => new Date(Date.now() + n * 86400000).toISOString()

const persona = (over: Partial<SuperAdminRow> = {}): SuperAdminRow => ({
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'ana@empresa.com',
  name: 'Ana Villalba',
  profileStatus: 'active',
  roleActive: true,
  roleSince: dias(-200),
  lastSignIn: dias(-1),
  ...over,
})

const pintar = (rows: SuperAdminRow[], yo = 'otro-id') =>
  render(<SuperAdminsManager rows={rows} currentUserId={yo} />)

/**
 * La busqueda por correo recorria como maximo cinco paginas de 200 usuarios de
 * `auth.users`. Pasado ese numero, promover a alguien devolvia «No existe un
 * usuario con email X»: una afirmacion falsa sobre una cuenta que sí existe.
 */
describe('buscar la cuenta no depende de cuantos usuarios haya', () => {
  const clienteConPerfil = (fila: unknown) => ({
    from: () => ({ select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: fila }) }) }) }),
    auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
  })

  it('la encuentra por `profiles`, que no tiene tope', async () => {
    const r = await findAuthUserByEmail(
      clienteConPerfil({ id: 'u-1', email: 'ana@empresa.com' }) as never,
      'Ana@Empresa.com'
    )
    expect(r.user).toEqual({ id: 'u-1', email: 'ana@empresa.com' })
    expect(r.scanTruncated).toBe(false)
  })

  it('sin perfil, cae al barrido de auth', async () => {
    const cliente = {
      from: () => ({ select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      auth: {
        admin: {
          listUsers: async () => ({ data: { users: [{ id: 'u-2', email: 'nuevo@empresa.com' }] }, error: null }),
        },
      },
    }
    const r = await findAuthUserByEmail(cliente as never, 'nuevo@empresa.com')
    expect(r.user?.id).toBe('u-2')
  })

  it('si el barrido se agota, lo dice en vez de afirmar que no existe', async () => {
    // Distinguir «no existe» de «no lo encontré» es la diferencia entre un dato
    // y una afirmación falsa.
    const llena = Array.from({ length: 200 }, (_, i) => ({ id: `x${i}`, email: `x${i}@a.com` }))
    const cliente = {
      from: () => ({ select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      auth: { admin: { listUsers: async () => ({ data: { users: llena }, error: null }) } },
    }
    const r = await findAuthUserByEmail(cliente as never, 'perdido@empresa.com')
    expect(r.user).toBeNull()
    expect(r.scanTruncated).toBe(true)
  })

  it('la API responde distinto en cada caso', () => {
    expect(RUTA_API).toContain('No hay ninguna cuenta registrada con')
    expect(RUTA_API).toContain('No se pudo confirmar si existe una cuenta con')
    expect(RUTA_API).toContain("code: 'LOOKUP_INCOMPLETE'")
  })

  it('el último acceso se pide por cada superadmin, sin barrer todo', () => {
    // Con el barrido, un superadmin que entró hoy figuraba como «Nunca».
    expect(PAGINA).toContain('await getLastSignIns(admin, userIds)')
    expect(PAGINA).not.toContain('for (let page = 1; page <= 5; page++)')
  })
})

describe('la API no repite lo que no pasó', () => {
  it('distingue dar, reactivar y ya tenerlo', () => {
    // El RPC hace upsert y devolvia exito siempre, asi que la pantalla anunciaba
    // una promocion aunque la persona ya fuera superadmin.
    expect(RUTA_API).toContain("outcome: wasActive ? 'already_active' : existingRole ? 'reactivated' : 'granted'")
  })

  it('no devuelve el error crudo de Postgres', () => {
    expect(RUTA_API).not.toContain('roleError.message || ')
    expect(RUTA_API).toContain("error: 'No se pudo asignar el rol.'")
  })

  it('valida que el id sea un uuid antes de tocar nada', () => {
    expect(RUTA_API).toContain('!UUID.test(userId)')
  })
})

describe('la pantalla dice quién tiene acceso, sin ceremonia', () => {
  it('resume en una frase en vez de tres tarjetas de estadística', () => {
    pintar([persona(), persona({ userId: 'b', email: 'b@e.com', name: 'Beto' })])
    expect(screen.getByText(/2 personas tienen/)).toBeInTheDocument()
    expect(screen.getByText(/acceso a\s+todas las organizaciones/)).toBeInTheDocument()
  })

  it('concuerda en singular', () => {
    pintar([persona()])
    expect(screen.getByText(/Una persona tiene/)).toBeInTheDocument()
  })

  it('«Dar acceso» está en el encabezado, no escondido en una barra lateral', () => {
    pintar([persona()])
    expect(screen.getByRole('button', { name: /Dar acceso/ })).toBeInTheDocument()
  })

  it('el buscador aparece solo cuando hay suficientes filas', () => {
    pintar([persona()])
    expect(screen.queryByPlaceholderText(/Buscar por nombre/)).not.toBeInTheDocument()

    const muchos = Array.from({ length: 9 }, (_, i) =>
      persona({ userId: `u${i}`, email: `u${i}@e.com`, name: `Persona ${i}` })
    )
    pintar(muchos)
    expect(screen.getByPlaceholderText(/Buscar por nombre/)).toBeInTheDocument()
  })
})

/**
 * Los roles revocados seguian en la misma lista, sumando al total y con un
 * boton «Revocar» que devolvia «el usuario no es un super_admin activo».
 */
describe('los accesos revocados se separan de los activos', () => {
  it('no cuentan como personas con acceso', () => {
    pintar([persona(), persona({ userId: 'b', email: 'b@e.com', roleActive: false })])
    expect(screen.getByText(/Una persona tiene/)).toBeInTheDocument()
    expect(screen.getByText(/1 rol revocado/)).toBeInTheDocument()
  })

  it('van en su propio bloque plegado', () => {
    pintar([persona(), persona({ userId: 'b', email: 'b@e.com', roleActive: false })])
    expect(screen.getByText('1 acceso revocado')).toBeInTheDocument()
  })

  it('y no ofrecen un botón que va a fallar', () => {
    pintar([persona({ userId: 'b', email: 'b@e.com', roleActive: false })])
    expect(screen.queryByRole('button', { name: /Quitar acceso/ })).not.toBeInTheDocument()
  })
})

describe('avisa de lo que hay que revisar, y solo cuando lo hay', () => {
  it('marca las cuentas dormidas', () => {
    pintar([persona({ lastSignIn: dias(-200) })])
    expect(screen.getByText(/más de 90 días/)).toBeInTheDocument()
  })

  it('sin cuentas dormidas no muestra el cartel', () => {
    // Antes era un aviso de seguridad permanente, que se vuelve invisible.
    pintar([persona({ lastSignIn: dias(-1) })])
    expect(screen.queryByText(/más de 90 días/)).not.toBeInTheDocument()
  })

  it('una cuenta sin perfil se señala en vez de mostrarse como «Usuario»', () => {
    pintar([persona({ name: null, email: null, missingProfile: true })])
    expect(screen.getByText('Sin perfil')).toBeInTheDocument()
    expect(screen.getByText('Sin correo registrado')).toBeInTheDocument()
  })
})

describe('quitarse el rol a uno mismo', () => {
  it('se explica, en vez de un botón muerto que dice «Sos vos»', () => {
    const yo = persona({ userId: 'yo-1' })
    pintar([yo, persona({ userId: 'b', email: 'b@e.com' })], 'yo-1')
    expect(screen.getByText('No podés quitarte el rol')).toBeInTheDocument()
  })
})

/**
 * Quitar acceso global se confirmaba con un solo clic sobre «Confirmar
 * revocación».
 */
describe('quitar el acceso pide confirmar a quién', () => {
  it('el botón queda bloqueado hasta escribir el correo', async () => {
    const usuario = userEvent.setup()
    pintar([persona(), persona({ userId: 'b', email: 'beto@empresa.com', name: 'Beto' })])

    await usuario.click(screen.getAllByRole('button', { name: /Quitar acceso/ })[1])

    const dialogo = screen.getByRole('dialog')
    const confirmar = within(dialogo).getByRole('button', { name: /Quitar acceso/ })
    expect(confirmar).toBeDisabled()

    await usuario.type(within(dialogo).getByLabelText(/para confirmar/), 'beto@empresa.com')
    expect(confirmar).toBeEnabled()
  })

  it('dice qué conserva la persona, no solo qué pierde', async () => {
    const usuario = userEvent.setup()
    pintar([persona(), persona({ userId: 'b', email: 'beto@empresa.com', name: 'Beto' })])
    await usuario.click(screen.getAllByRole('button', { name: /Quitar acceso/ })[1])
    expect(screen.getByText(/Conserva su acceso\s+normal como administrador/)).toBeInTheDocument()
  })
})

describe('el rol se explica en castellano', () => {
  it('no se le muestra al usuario el nombre de la columna', async () => {
    // Se afirma sobre lo RENDERIZADO: el nombre viejo sobrevive en los
    // comentarios que explican por qué se cambió, y afirmar sobre el texto
    // fuente hace que la prueba falle por el comentario, no por la pantalla.
    const usuario = userEvent.setup()
    pintar([persona()])
    await usuario.click(screen.getByText('Qué significa este rol'))
    expect(document.body.textContent).not.toContain('super_admin')
  })

  it('hay una explicación de qué puede hacer y qué queda registrado', () => {
    pintar([persona()])
    expect(screen.getByText('Qué significa este rol')).toBeInTheDocument()
  })
})
