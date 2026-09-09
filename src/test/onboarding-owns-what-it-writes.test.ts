import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { BRAND_COLORS, isKnownBrandColor } from '@/lib/website/brand-colors'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const MIGRACION = leer('supabase/migrations/20260908140000_onboarding_preserves_website_settings.sql')
const RUTA = leer('src/app/api/onboarding/complete/route.ts')
const PAGINA = leer('src/app/dashboard/onboarding/page.tsx')
const CLIENTE = leer('src/components/dashboard/onboarding/OnboardingClient.tsx')
const MENU = leer('src/components/dashboard/sidebar.tsx')
const FORM_WEB = leer('src/components/admin/website/CompanyInfoForm.tsx')

/**
 * La RPC hacia `set value = excluded.value` sobre `company_info`: un reemplazo
 * completo. Y la ruta armaba ese valor desde cero en cada guardado, con
 * decisiones de diseño escritas a mano. Un admin que personalizo su tienda en
 * /admin/website y volvia al onboarding a corregir un telefono, perdia el color
 * propio, el eslogan, la descripcion y el enlace al mapa.
 */
describe('guardar el onboarding ya no borra la pagina publica', () => {
  it('la fila se fusiona en vez de reemplazarse', () => {
    expect(MIGRACION).toContain('merged_company := existing_company || coalesce(p_company_info')
    expect(MIGRACION).not.toContain('coalesce(p_company_info, \'{}\'::jsonb) || (\n      select jsonb_build_object')
  })

  it('el horario se fusiona clave por clave', () => {
    // `||` es superficial: mandar {weekdays, saturday} borraba el domingo.
    expect(MIGRACION).toContain("if p_company_info ? 'hours' then")
    expect(MIGRACION).toContain("jsonb_set(\n      merged_company,\n      '{hours}',")
  })

  it('la ruta deja de mandar constantes de diseño que no le pertenecen', () => {
    expect(RUTA).not.toContain("brandColor: 'blue'")
    expect(RUTA).not.toContain("headerStyle: 'glass'")
    expect(RUTA).not.toContain("headerColor: ''")
    expect(RUTA).not.toContain('showTopBar: true')
  })

  it('ni el domingo en vacio', () => {
    const bloque = RUTA.slice(RUTA.indexOf('const websiteCompanyInfo'), RUTA.indexOf('const { data: completion'))
    expect(bloque).not.toContain("sunday: ''")
  })

  it('el color de marca pasa a ser una eleccion, no una constante', () => {
    expect(RUTA).toContain('brandColor: input.brandColor')
    expect(RUTA).toContain('isKnownBrandColor')
  })
})

/**
 * El array se llamaba `initialWebsiteRows` —la intencion era «solo la primera
 * vez»— pero el upsert corria en cada guardado y reemplazaba el encabezado y
 * los pasos de proceso escritos a mano.
 */
describe('el contenido del sitio se siembra una sola vez', () => {
  it('se consulta que existe antes de escribir', () => {
    expect(RUTA).toContain("const alreadyPresent = new Set((existingRows ?? []).map((row) => row.key))")
    expect(RUTA).toContain('seedableKeys.filter((row) => !alreadyPresent.has(row.key))')
  })

  it('se usa insert y no upsert, para que no pueda pisar', () => {
    const bloque = RUTA.slice(RUTA.indexOf('const seedFailures'), RUTA.indexOf('const planInfo'))
    expect(bloque).toContain(".insert({")
    expect(bloque).not.toContain('.upsert(')
  })

  it('si no se sabe que hay, no se escribe nada', () => {
    // Perder contenido es peor que no sembrarlo.
    expect(RUTA).toContain('const rowsToSeed = existingRowsError')
  })

  it('el error de la siembra deja de descartarse', () => {
    expect(RUTA).toContain('seedFailures.push(row.key)')
    expect(RUTA).toContain('websiteContentIncomplete: seedFailures.length > 0')
    expect(CLIENTE).toContain('payload?.websiteContentIncomplete')
  })

  it('los interruptores del rubro solo se proponen la primera vez', () => {
    expect(RUTA).toContain('if (!alreadyCompleted) {\n    websiteCompanyInfo.servicesPageEnabled')
  })
})

describe('los modulos elegidos a mano sobreviven a una revisita', () => {
  it('solo se sugieren en el primer guardado', () => {
    // /api/admin/organization-profile los elige con validacion de plan y
    // auditoria; el onboarding los pisaba con la sugerencia del rubro.
    expect(RUTA).toContain('if (!alreadyCompleted) {\n    organizationUpdate.enabled_modules = suggestedModules')
    expect(RUTA).toContain('const enabledModules = alreadyCompleted ? null : suggestedModules')
  })
})

/**
 * `storefront_public` arranca en false y el onboarding nunca la publicaba. El
 * paso se marcaba listo con la sola existencia de la fila `company_info` —que
 * crea el propio onboarding—, asi que decia «Listo» y su enlace llevaba a una
 * tienda que nadie podia ver.
 */
describe('la tienda publica se decide, y el paso dice la verdad', () => {
  it('el paso sale de la señal real', () => {
    expect(PAGINA).toContain("const storefrontPublic = businessProfile?.storefront_public === true")
    expect(PAGINA).toContain('hasPublicStore: storefrontPublic,')
    expect(PAGINA).not.toContain('hasPublicStore: Boolean(companyInfoSetting?.value)')
  })

  it('hay un interruptor explicito que dice que pasa en cada estado', () => {
    expect(CLIENTE).toContain('id="storefrontPublic"')
    expect(CLIENTE).toContain('nadie puede verla todavía')
    expect(CLIENTE).toContain('Cualquiera con el enlace va a poder ver tu catálogo')
  })

  it('la publicacion se escribe antes de la RPC', () => {
    // La funcion lee `storefront_public` para estamparlo en company_info:
    // escribirla despues dejaba la fila publica con el valor anterior.
    expect(RUTA.indexOf('const { error: publicationError }')).toBeLessThan(
      RUTA.indexOf("'complete_organization_onboarding'")
    )
  })

  it('apagar la tienda tambien la saca del marketplace', () => {
    expect(RUTA).toContain('if (!input.storefrontPublic) publicationUpdate.marketplace_public = false')
  })

  it('mientras esta pendiente, el enlace lleva al interruptor y no a la tienda apagada', () => {
    expect(CLIENTE).toContain("const pendingStorefront = step.doneKey === 'hasPublicStore' && !done")
    expect(CLIENTE).toContain("{done ? 'Revisar' : pendingStorefront ? 'Publicar' : 'Configurar'}")
  })
})

describe('el color de marca es el mismo conjunto en las dos pantallas', () => {
  it('la paleta vive en un solo lugar', () => {
    expect(FORM_WEB).toContain("from '@/lib/website/brand-colors'")
    expect(CLIENTE).toContain("from '@/lib/website/brand-colors'")
    expect(BRAND_COLORS.length).toBeGreaterThan(6)
  })

  it('«custom» es valido: el color real vive en customBrandColor', () => {
    expect(isKnownBrandColor('custom')).toBe(true)
    expect(isKnownBrandColor('blue')).toBe(true)
    expect(isKnownBrandColor('fucsia-inventado')).toBe(false)
    expect(isKnownBrandColor(null)).toBe(false)
  })

  it('la pantalla avisa cuando ya hay un color propio en vez de pisarlo', () => {
    expect(CLIENTE).toContain("form.brandColor === 'custom' ?")
    expect(CLIENTE).toContain('Ya tenés un color propio configurado en')
    expect(CLIENTE).toContain('Elegí uno de acá solo si querés reemplazarlo')
  })
})

describe('el menu ofrece la pantalla a quien puede entrar', () => {
  it('mismos roles que exige la pagina', () => {
    // Se la ofrecia a vendedor y tecnico, y la pagina los devolvia al panel.
    const item = MENU.slice(MENU.indexOf("href: '/dashboard/onboarding'") - 200, MENU.indexOf("href: '/dashboard/onboarding'") + 200)
    expect(item).toContain("roles: ['super_admin', 'admin']")
    expect(item).not.toContain("'vendedor'")
  })

  it('con nombre en castellano, como el resto del menu', () => {
    expect(MENU).not.toContain("name: 'Onboarding'")
    expect(MENU).toContain("name: 'Configuración del negocio'")
  })

  it('mientras falta configurar es una tarea del dia a dia', () => {
    const principal = MENU.slice(MENU.indexOf("label: 'Principal'"), MENU.indexOf("label: 'Operaciones'"))
    expect(principal).toContain("href: '/dashboard/onboarding'")
  })

  it('la cadena que esconde el item esta completa', () => {
    // Se habia quedado a medias: la variable existia y el filtro la leia, pero
    // nada la ponia en `true`, asi que el item no se escondia nunca. Un test
    // que solo mirara el filtro no lo habria detectado.
    expect(MENU).toContain('const [onboardingDone, setOnboardingDone] = useState(false)')
    expect(MENU).toContain('fetchOnboardingStatus().then((data) => {')
    expect(MENU).toContain('if (data?.completed) setOnboardingDone(true)')
    expect(MENU).toContain("if (item.href === '/dashboard/onboarding' && onboardingDone) return false")
    // Sin la dependencia, el menu no se recalcula cuando llega la respuesta.
    expect(MENU).toContain('onboardingDone, hasPermission')
  })

  it('el rol se filtra donde el menu de verdad lo consulta', () => {
    // `item.roles` no lo lee nadie en la barra lateral: el filtro real es
    // `canRoleAccessSection`. Cambiar solo el primero no hacia nada.
    const ACCESO = leer('src/lib/auth/section-access.ts')
    expect(ACCESO).not.toContain("'/dashboard/onboarding'")
    expect(MENU).toContain('canRoleAccessSection(userRole, item.href)')
  })

  it('completa, sale del menu diario y queda con el resto de los ajustes', () => {
    // Esconderla en los dos lados dejaba el modo «revisita» inalcanzable;
    // dejarla en «Principal» para siempre era ruido permanente.
    expect(MENU).toContain("if (item.href === '/dashboard/onboarding' && onboardingDone) return false")

    const NAV_ADMIN = leer('src/config/admin-navigation.ts')
    const administracion = NAV_ADMIN.slice(NAV_ADMIN.indexOf("id: 'administration'"))
    expect(administracion).toContain("key: 'business-profile'")
    expect(administracion).toContain("href: '/dashboard/onboarding'")
    // Junto a «Sitio Web», que es la otra mitad de lo mismo.
    expect(administracion).toContain("label: 'Sitio Web'")
  })

  it('el mismo permiso que sus vecinos de Administración', () => {
    const NAV_ADMIN = leer('src/config/admin-navigation.ts')
    const item = NAV_ADMIN.slice(NAV_ADMIN.indexOf("key: 'business-profile'"))
    expect(item.slice(0, 300)).toContain("permissions: ['settings.read']")
  })
})

describe('validacion y limpieza', () => {
  it('el servidor valida la URL del logo como el cliente', () => {
    expect(RUTA).toContain('La URL del logo debe empezar con http:// o https://')
  })

  it('la lista que no leia nadie ya no se guarda', () => {
    expect(RUTA).not.toContain('required_company_fields')
  })

  it('el horario usa el icono del resto de la pantalla', () => {
    expect(CLIENTE).not.toContain('🕒')
    expect(CLIENTE).toContain('<Clock className="h-3 w-3 shrink-0" />')
  })

  it('el hueco en la auditoria se registra en vez de descartarse', () => {
    expect(RUTA).toContain('const { error: auditError }')
    expect(RUTA).toContain('Onboarding saved without audit trail')
  })
})

/**
 * El formulario puede tener cambios sin guardar y hay un `beforeunload` que lo
 * protege, pero la navegacion interna de Next es del lado del cliente: no lo
 * dispara. Cualquier enlace que saque de esta pantalla perdia lo cargado en
 * silencio.
 */
describe('salir de la pantalla no cuesta lo que cargaste', () => {
  it('el sitio completo se abre en otra pestaña', () => {
    expect(CLIENTE).toContain('Abrir Sitio Web en otra pestaña')
    expect(CLIENTE).toContain('<Link href="/admin/website" target="_blank" rel="noopener noreferrer">')
    expect(CLIENTE).toContain('Se abre en una pestaña nueva para que no pierdas lo que cargaste acá')
  })

  it('y los pasos que llevan a otras secciones también', () => {
    // Antes solo la tienda publica abria pestaña nueva; «Productos» y «Equipo»
    // navegaban encima del formulario.
    expect(CLIENTE).toContain("const leavesOnboarding = !pendingStorefront && !href.startsWith('/dashboard/onboarding')")
    expect(CLIENTE).toContain("target={leavesOnboarding ? '_blank' : undefined}")
  })

  it('el enlace que vuelve a esta misma pantalla no abre pestaña', () => {
    expect(CLIENTE).toContain("!href.startsWith('/dashboard/onboarding')")
  })
})

describe('el enlace dice qué se configura del otro lado', () => {
  it('enumera las secciones en vez de mandar a ciegas', () => {
    expect(CLIENTE).toContain('Acá elegís lo esencial. El sitio completo se configura aparte.')
    expect(CLIENTE).toContain('el encabezado y la')
    expect(CLIENTE).toContain('catálogo de servicios, los pasos del proceso y las formas de pago y entrega')
  })

  it('usa el nombre que la sección tiene en el menú', () => {
    // Se llama «Sitio Web» en admin-navigation; «Diseño del sitio» era un
    // nombre inventado que el usuario no iba a encontrar en ningún lado.
    const NAV = leer('src/config/admin-navigation.ts')
    expect(NAV).toContain("label: 'Sitio Web'")
    expect(CLIENTE).not.toContain('Diseño del sitio')
    expect(CLIENTE).toContain('Sitio Web')
  })
})
