import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const readProjectFile = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

describe('endurecimiento de produccion', () => {
  it('bloquea el build ante errores TypeScript y aplica la CSP', () => {
    const config = readProjectFile('next.config.ts')

    expect(config).toContain('ignoreBuildErrors: false')
    expect(config).toContain("key: 'Content-Security-Policy'")
    expect(config).not.toContain("key: 'Content-Security-Policy-Report-Only'")
  })

  it('la CSP deja cargar y enviar Cloudflare Web Analytics', () => {
    const config = readProjectFile('next.config.ts')
    const scriptSrc = config.match(/\? "script-src [^"]+"/)?.[0] ?? ''
    expect(scriptSrc).toContain('https://static.cloudflareinsights.com')
    expect(config).toMatch(/"connect-src [^"]*https:\/\/cloudflareinsights\.com/)
  })

  it('no conserva configuracion ni codigo ejecutable de V0 o WhatsApp Cloud', () => {
    const envExample = readProjectFile('.env.example')
    const communicationsPage = readProjectFile(
      'src/app/dashboard/repairs/communications/page.tsx'
    )

    expect(envExample).not.toMatch(/V0_API_KEY|V0_PROJECT_ID/)
    expect(envExample).not.toMatch(/WHATSAPP_CLOUD_API_TOKEN|WHATSAPP_PHONE_NUMBER_ID/)
    expect(communicationsPage).not.toContain('WhatsApp Cloud')

    for (const relativePath of [
      'test-wa.cjs',
      'docs/CONFIGURACION_V0.md',
      'src/lib/services/whatsapp-service.ts',
      'src/app/api/whatsapp/webhook/route.ts',
      'src/app/api/repairs/communications/whatsapp/route.ts',
    ]) {
      expect(existsSync(resolve(projectRoot, relativePath)), relativePath).toBe(false)
    }
  })

  it('mantiene WhatsApp manual sin redirigir a un numero ficticio', () => {
    const whatsapp = readProjectFile('src/lib/whatsapp.ts')
    const communications = readProjectFile('src/hooks/use-repair-communications.ts')

    expect(whatsapp).not.toContain("|| '595981123456'")
    expect(communications).toContain('https://wa.me/')
    expect(communications).toContain('https://web.whatsapp.com/send')
  })

  it('no distribuye paneles que presentan metricas y backups simulados', () => {
    expect(
      existsSync(resolve(projectRoot, 'src/components/admin/system/system-monitoring.tsx'))
    ).toBe(false)
    expect(
      existsSync(resolve(projectRoot, 'src/components/optimization/performance-dashboard.tsx'))
    ).toBe(false)
  })

  it('no muestra stack ni mensajes internos en el error global de producción', () => {
    const globalError = readProjectFile('src/app/global-error.tsx')
    const superadminError = readProjectFile('src/app/superadmin/error.tsx')

    expect(globalError).toContain("process.env.NODE_ENV === 'development'")
    expect(globalError).toContain("logger.error('Global render error:', error)")
    expect(globalError).not.toContain('console.error(error)')
    expect(superadminError).toContain("logger.error('SuperAdmin render error:', error)")
  })
})
