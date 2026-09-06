import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const BOTON = leer('src/components/pwa/install-prompt.tsx')
const NAV = leer('src/components/public/marketplace-public-nav.tsx')

/**
 * El evento `beforeinstallprompt` se consume al usarlo: despues de un rechazo
 * `prompt()` ya no sirve. El componente lo ponia en null y con eso caia en el
 * `return null`, asi que el boton desaparecia sin decir nada —y el navegador
 * puede tardar dias en volver a ofrecer.
 *
 * Verificado en el navegador a 375px: se despacha un `beforeinstallprompt`
 * falso con `userChoice` rechazado, se hace clic y el boton sigue ahi; el
 * segundo clic abre el cartel con los dos pasos.
 */
describe('el boton no desaparece cuando se rechaza la instalacion', () => {
  it('recuerda que el evento ya se gasto', () => {
    expect(BOTON).toContain('const [promptUsed, setPromptUsed] = useState(false)')
    expect(BOTON).toContain('setPromptUsed(true)')
  })

  it('sigue mostrandose con ese recuerdo, aunque no haya evento ni sea iOS', () => {
    expect(BOTON).toContain('if (!deferredPrompt && !isIOS && !promptUsed) return null')
  })

  it('un evento nuevo lo vuelve a habilitar', () => {
    // Si el navegador reofrece, el boton tiene que volver a disparar el suyo en
    // vez de quedarse en modo instrucciones para siempre.
    const alRecibir = BOTON.slice(BOTON.indexOf('setDeferredPrompt(event as BeforeInstallPromptEvent)'))
    expect(alRecibir.slice(0, 120)).toContain('setPromptUsed(false)')
  })

  it('ya instalada sigue sin boton', () => {
    // El recuerdo del rechazo no debe sobrevivir a la instalacion.
    expect(BOTON).toContain('if (isStandalone) return null')
    const alInstalar = BOTON.slice(BOTON.indexOf('const installedHandler'))
    expect(alInstalar.slice(0, 200)).toContain('setIsStandalone(true)')
  })
})

/**
 * Las instrucciones de iOS vivian en un `toast` de 8 segundos. Se leen en la
 * pagina y se ejecutan en la barra de Safari: para cuando la persona encuentra
 * Compartir, el aviso ya no esta.
 */
describe('las instrucciones se quedan en pantalla', () => {
  it('van en un dialogo, no en un aviso que se va solo', () => {
    expect(BOTON).toContain('<Dialog open={guideOpen} onOpenChange={setGuideOpen}>')
    expect(BOTON).not.toContain("toast.info('Para instalar en iPhone o iPad'")
  })

  it('sin evento del navegador, el clic abre el dialogo', () => {
    const alHacerClic = BOTON.slice(BOTON.indexOf('if (!deferredPrompt) {'))
    expect(alHacerClic.slice(0, 80)).toContain('setGuideOpen(true)')
  })

  it('los pasos cambian segun la plataforma', () => {
    // Safari se instala desde Compartir; Chrome y Edge desde los tres puntos.
    expect(BOTON).toContain('texto: \'Tocá el botón Compartir en la barra de Safari.\'')
    expect(BOTON).toContain('texto: \'Abrí el menú del navegador (los tres puntos).\'')
  })

  it('las tres variantes del boton lo llevan', () => {
    // El de menu y el compacto tambien caen en `handleInstallClick`: sin el
    // dialogo montado al lado, ahi el clic no hace nada.
    expect(BOTON.match(/\{guia\}/g)).toHaveLength(3)
  })
})

/**
 * iPadOS 13+ se anuncia como Macintosh. Con solo mirar el userAgent, el iPad
 * no era iOS ni recibia `beforeinstallprompt`: se caia por los dos lados y el
 * boton no aparecia nunca.
 */
describe('el iPad moderno cuenta como iOS', () => {
  it('se lo reconoce por los puntos de contacto', () => {
    expect(BOTON).toContain('/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1')
    expect(BOTON).toContain('/iPad|iPhone|iPod/.test(nav.userAgent) || iPadOS')
  })

  it('la deteccion sigue en un efecto', () => {
    // Leer `navigator` en el render rompe la hidratacion.
    const efecto = BOTON.slice(BOTON.indexOf('useEffect(() => {'))
    expect(efecto.slice(0, 400)).toContain('window.navigator as Navigator')
  })
})

/**
 * Medido en el navegador: 36x36 a 1280px y 44x44 a 375px, igual que la lupa y
 * el selector de tema; la fila no desborda en ninguno de los dos.
 */
describe('en el encabezado tiene la forma del resto de la fila', () => {
  it('usa la variante de icono con la geometria de los vecinos', () => {
    const uso = NAV.slice(NAV.indexOf('<InstallPrompt'))
    expect(uso.slice(0, 400)).toContain('variant="icon"')
    expect(uso.slice(0, 400)).toContain('h-9 w-9 items-center justify-center rounded-xl')
  })

  it('ya no entra como boton de texto', () => {
    expect(NAV).not.toContain('<InstallPrompt />')
  })
})
