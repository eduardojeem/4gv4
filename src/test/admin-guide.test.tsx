import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminNavCategories } from '@/config/admin-navigation'
import { GUIDE_SECTIONS, guideSectionByNavKey } from '@/lib/guide/content'
import { filterGuideSections, searchGuideSections } from '@/lib/guide/types'
import {
  assessFirstSteps,
  filterFirstSteps,
  summarizeFirstSteps,
  type FirstStepsInput,
} from '@/lib/guide/first-steps'

const MODULOS = [
  'inventory',
  'inventory_admin',
  'pos',
  'crm',
  'orders',
  'ecommerce',
  'analytics',
  'security',
  'repairs',
  'promotions',
  'credits',
  'services',
  'delivery',
]

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { id: 'admin-1', role: 'admin' }, isAdmin: true, hasPermission: () => true }),
}))

let modulosDelPlan = MODULOS
vi.mock('@/contexts/SubscriptionStatusContext', () => ({
  useSubscriptionStatus: () => ({ effectiveModules: modulosDelPlan, businessVertical: 'electronics' }),
}))

const vacia = (over: Partial<FirstStepsInput> = {}): FirstStepsInput => ({
  businessName: '',
  contactPhone: '',
  address: '',
  activeProducts: 0,
  cashRegisters: 0,
  completedSales: 0,
  storefrontPublic: false,
  staffMembers: 1,
  ...over,
})

/**
 * El onboarding marca «completado» al terminar el formulario: hoy hay 12 de 13
 * organizaciones completas, y cuatro sin un solo producto, cinco sin caja y
 * siete sin ninguna venta. Estos pasos se responden con los datos.
 */
describe('primeros pasos de una cuenta nueva', () => {
  it('una cuenta recién creada arranca en cero y sabe por dónde seguir', () => {
    const avance = assessFirstSteps(vacia())
    expect(avance.done).toBe(0)
    expect(avance.percent).toBe(0)
    expect(avance.readyToSell).toBe(false)
    expect(avance.next?.key).toBe('negocio')
  })

  it('cuenta lo que hay, no lo que dice una bandera', () => {
    const avance = assessFirstSteps(vacia({
      businessName: '4G celulares',
      contactPhone: '0985796523',
      address: 'Av. Mcal. López 1234',
      activeProducts: 33,
      cashRegisters: 1,
      completedSales: 0,
    }))
    const detalle = (key: string) => avance.steps.find((step) => step.key === key)?.detail
    expect(detalle('productos')).toBe('33 productos activos en el catálogo')
    expect(detalle('caja')).toBe('1 caja creada')
    expect(detalle('venta')).toBe('Todavía sin ventas registradas')
    // Lo imprescindible está: ya puede cobrar, aunque falten pasos que suman.
    expect(avance.readyToSell).toBe(true)
    expect(avance.next?.key).toBe('venta')
  })

  it('una tienda publicada sin productos no cuenta como publicada', () => {
    const paso = assessFirstSteps(vacia({ storefrontPublic: true, contactPhone: '0985796523' }))
      .steps.find((step) => step.key === 'tienda')
    expect(paso?.done).toBe(false)
    expect(paso?.detail).toContain('no tiene productos')
  })

  it('«sos la única persona con acceso» no es un error, es un paso pendiente', () => {
    const solo = assessFirstSteps(vacia()).steps.find((step) => step.key === 'equipo')
    expect(solo?.done).toBe(false)
    expect(solo?.detail).toBe('Sos la única persona con acceso')
    const equipo = assessFirstSteps(vacia({ staffMembers: 4 })).steps.find((step) => step.key === 'equipo')
    expect(equipo?.done).toBe(true)
    expect(equipo?.detail).toBe('4 personas con acceso')
  })

  /** Un taller sin POS no tiene que ver «creá tu caja» como tarea pendiente. */
  it('los pasos de un módulo que el plan no trae no se muestran', () => {
    const todos = assessFirstSteps(vacia()).steps
    const sinPos = filterFirstSteps(todos, { modules: ['inventory', 'crm'] })
    expect(sinPos.map((step) => step.key)).not.toContain('caja')
    expect(sinPos.map((step) => step.key)).not.toContain('venta')
    expect(summarizeFirstSteps(sinPos).total).toBe(todos.length - 2)
  })

  it('sin permiso para invitar gente, ese paso no aparece', () => {
    const todos = assessFirstSteps(vacia()).steps
    const sinUsuarios = filterFirstSteps(todos, { hasPermission: (permission) => permission !== 'users.create' })
    expect(sinUsuarios.map((step) => step.key)).not.toContain('equipo')
  })

  it('el avance se recalcula sobre los pasos que quedaron', () => {
    const todos = assessFirstSteps(vacia({ activeProducts: 5 })).steps
    const resumen = summarizeFirstSteps(filterFirstSteps(todos, { modules: ['inventory'] }))
    expect(resumen.total).toBe(4)
    expect(resumen.done).toBe(1)
    expect(resumen.percent).toBe(25)
  })
})

describe('contenido de la guía', () => {
  /** Si una sección entra al menú y nadie la explica, la guía queda a medias. */
  it('cada sección del menú tiene su explicación', () => {
    const delMenu = adminNavCategories
      .flatMap((category) => category.items)
      .map((item) => item.key)
      .filter((key) => key !== 'guide')

    const sinGuia = delMenu.filter((key) => !guideSectionByNavKey(key))
    expect(sinGuia).toEqual([])
  })

  it('todos los enlaces llevan a una pantalla que existe', () => {
    const enlaces = GUIDE_SECTIONS
      .map((section) => section.href)
      .filter((href): href is string => typeof href === 'string')

    const rotos = enlaces.filter((href) => !existsSync(resolve(process.cwd(), `src/app${href}/page.tsx`)))
    expect(rotos).toEqual([])
  })

  it('cada paso de los primeros pasos también lleva a una pantalla real', () => {
    const rotos = assessFirstSteps(vacia()).steps
      .map((step) => step.action.href)
      .filter((href) => !existsSync(resolve(process.cwd(), `src/app${href}/page.tsx`)))
    expect(rotos).toEqual([])
  })

  it('toda sección explica sus pasos, y las pantallas traen ejemplo', () => {
    for (const section of GUIDE_SECTIONS) {
      expect(section.steps.length, section.id).toBeGreaterThanOrEqual(2)
      expect(section.keywords.length, section.id).toBeGreaterThan(0)
    }
    // Las pantallas del menú son las que la gente usa: esas sí llevan ejemplo.
    for (const section of GUIDE_SECTIONS.filter((item) => item.navKey)) {
      expect(section.examples?.length ?? 0, section.id).toBeGreaterThan(0)
    }
  })

  /**
   * El texto viejo inventaba un rol «Solo lectura» y mandaba a pedirle a
   * soporte los permisos que hoy se marcan con un casillero en Usuarios.
   */
  it('no vuelve a describir roles ni funciones que no existen', () => {
    // Se mira el contenido, no el archivo: los comentarios sí nombran el error
    // viejo, que es justamente lo que este test evita que vuelva.
    const texto = JSON.stringify(GUIDE_SECTIONS)
    expect(texto).not.toMatch(/solo lectura/i)
    expect(texto).not.toMatch(/enterprise/i)
    expect(texto).not.toMatch(/contact[aá] a? ?soporte/i)

    const roles = GUIDE_SECTIONS.find((section) => section.id === 'roles')
    const cuerpo = JSON.stringify(roles)
    expect(cuerpo).toMatch(/Propietario/)
    expect(cuerpo).toMatch(/transferencia de propiedad/)
  })

  it('se busca sin tildes y por la palabra que usa la gente', () => {
    expect(searchGuideSections(GUIDE_SECTIONS, 'arqueo').map((s) => s.id)).toContain('cash-monitor')
    expect(searchGuideSections(GUIDE_SECTIONS, 'auditoria').map((s) => s.id)).toContain('cash-monitor')
    expect(searchGuideSections(GUIDE_SECTIONS, 'PUBLICAR').map((s) => s.id)).toContain('website')
    expect(searchGuideSections(GUIDE_SECTIONS, 'talles').map((s) => s.id)).toContain('inventory')
    expect(searchGuideSections(GUIDE_SECTIONS, '').length).toBe(GUIDE_SECTIONS.length)
  })

  /**
   * El menú le muestra todo al admin sin mirar permisos; `hasPermission`
   * devuelve false cuando la organización le listó permisos explícitos, así que
   * sin esta regla la guía escondía secciones que el menú sí mostraba.
   */
  it('un admin ve todo lo que el plan incluye, igual que en el menú', () => {
    const sinPermisos = () => false
    const comoAdmin = filterGuideSections(GUIDE_SECTIONS, { hasPermission: sinPermisos, isAdmin: true, modules: MODULOS })
    expect(comoAdmin.length).toBe(GUIDE_SECTIONS.length)

    const sinRol = filterGuideSections(GUIDE_SECTIONS, { hasPermission: sinPermisos, isAdmin: false, modules: MODULOS })
    expect(sinRol.map((section) => section.id)).not.toContain('users')

    // El plan manda igual: ser admin no desbloquea un módulo que no está.
    expect(filterGuideSections(GUIDE_SECTIONS, { isAdmin: true, modules: ['pos'] }).map((s) => s.id))
      .not.toContain('analytics')

    // Y los pasos siguen la misma regla.
    const pasos = filterFirstSteps(assessFirstSteps(vacia()).steps, {
      hasPermission: sinPermisos,
      isAdmin: true,
      modules: MODULOS,
    })
    expect(pasos).toHaveLength(6)
  })

  it('no explica secciones que el plan no incluye', () => {
    const sinAnalitica = filterGuideSections(GUIDE_SECTIONS, { modules: ['inventory', 'pos'] })
    expect(sinAnalitica.map((section) => section.id)).not.toContain('analytics')
    expect(sinAnalitica.map((section) => section.id)).not.toContain('security')
    expect(sinAnalitica.map((section) => section.id)).toContain('users')
  })
})

describe('pantalla de la guía', () => {
  beforeEach(() => {
    modulosDelPlan = MODULOS
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          businessName: 'HCA Celular',
          contactPhone: '0985796523',
          address: 'Asunción',
          activeProducts: 47,
          cashRegisters: 1,
          completedSales: 1,
          storefrontPublic: true,
          staffMembers: 2,
        },
      }),
    })) as unknown as typeof fetch)
  })

  it('muestra los primeros pasos con los datos de la organización', async () => {
    const { GuideView } = await import('@/components/admin/guide/GuideView')
    render(<GuideView />)

    expect(screen.getByRole('heading', { name: 'Guía del sistema', level: 1 })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('47 productos activos en el catálogo')).toBeInTheDocument())
    expect(screen.getByText('6 de 6 pasos')).toBeInTheDocument()
    expect(screen.getByText('Listo para vender')).toBeInTheDocument()
  })

  it('oculta lo que el plan no trae', async () => {
    modulosDelPlan = ['inventory', 'pos', 'crm']
    const { GuideView } = await import('@/components/admin/guide/GuideView')
    render(<GuideView />)

    expect(screen.queryByText('Analytics')).not.toBeInTheDocument()
    expect(screen.queryByText('Seguridad')).not.toBeInTheDocument()
    expect(screen.getByText('Usuarios')).toBeInTheDocument()
  })

  it('permite filtrar por categorías y preguntas frecuentes', async () => {
    const { GuideView } = await import('@/components/admin/guide/GuideView')
    const { fireEvent } = await import('@testing-library/react')
    render(<GuideView />)

    // Botones de filtro de categoría presentes
    expect(screen.getByRole('button', { name: /Todos/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dashboard \/ Operaciones/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Admin \/ Gestión/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Inicio por Rubro/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Primeros pasos/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Preguntas Frecuentes/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Imprimir/ })).toBeInTheDocument()

    // Cambiar a la pestaña de FAQ
    fireEvent.click(screen.getByRole('button', { name: /Preguntas Frecuentes/ }))
    expect(screen.getByRole('heading', { name: 'Preguntas Frecuentes', level: 2 })).toBeInTheDocument()

    // Cambiar a la pestaña de Inicio por Rubro
    fireEvent.click(screen.getByRole('button', { name: /Inicio por Rubro/ }))
    expect(screen.getByText(/Plan de Inicio: 4 pasos para poner a punto/)).toBeInTheDocument()
    expect(screen.getByText(/Rutina Diaria Recomendada para/)).toBeInTheDocument()
  })
})

describe('recomendaciones estratégicas por rubro', () => {
  it('provee planes y rutinas detalladas para cada rubro', async () => {
    const { getVerticalRecommendation } = await import('@/lib/guide/vertical-recommendations')
    
    const electronics = getVerticalRecommendation('electronics')
    expect(electronics.title).toContain('Tecnología')
    expect(electronics.startingSteps.length).toBe(4)
    expect(electronics.dailyRoutine.opening).toBeDefined()
    expect(electronics.dailyRoutine.closing).toBeDefined()
    expect(electronics.pitfallsToAvoid.length).toBeGreaterThan(0)

    const clothing = getVerticalRecommendation('clothing')
    expect(clothing.title).toContain('Indumentaria')
    expect(clothing.startingSteps.length).toBe(4)

    const fallback = getVerticalRecommendation('inexistente' as any)
    expect(fallback.title).toContain('Comercio General')
  })
})

describe('exportación e impresión de la guía', () => {
  it('genera un documento HTML estructurado para imprimir', async () => {
    const { printAdminGuide } = await import('@/lib/guide/guide-printer')
    const mockDocument = {
      write: vi.fn(),
      close: vi.fn(),
    }
    const mockWindow = {
      document: mockDocument,
      focus: vi.fn(),
    }
    vi.stubGlobal('open', vi.fn(() => mockWindow))

    printAdminGuide(GUIDE_SECTIONS.slice(0, 3), {
      companyName: 'Test Empresa',
      title: 'Manual de Prueba',
    })

    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(mockDocument.write).toHaveBeenCalled()
    const htmlWritten = mockDocument.write.mock.calls[0][0] as string
    expect(htmlWritten).toContain('Manual de Prueba')
    expect(htmlWritten).toContain('Test Empresa')
    expect(htmlWritten).toContain('window.print()')
    expect(mockDocument.close).toHaveBeenCalled()
    expect(mockWindow.focus).toHaveBeenCalled()
  })
})
