import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('auditoría de navegador para System Health', () => {
  it('audita contraste y estructura de formularios sin enviarlos', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    const script = readFileSync(resolve(process.cwd(), 'scripts/audit-public-browser.mjs'), 'utf8')

    expect(pkg.scripts['audit:browser']).toBe('node scripts/audit-public-browser.mjs')
    expect(script).toContain("import axe from 'axe-core'")
    expect(script).toContain("'/saas'")
    expect(script).toContain("'/marketplace'")
    expect(script).toContain("'/register'")
    expect(script).toContain("values: ['wcag2a', 'wcag2aa', 'wcag21aa']")
    expect(script).toContain('form.checkValidity()')
    expect(script).not.toContain('.submit(')
    expect(script).toContain("waitUntil: 'domcontentloaded'")
    expect(script).toContain('navigationError')
    expect(script).toContain('bypassCSP: true')
    expect(script).toContain('failureSummary')
    expect(script).toContain("page.title().catch(() => '')")
    expect(script).toContain('const auditable = status >= 200 && status < 400')
    expect(script).toContain("reason: 'La pagina devolvio un desafio o error HTTP; no se audita su HTML intermedio.'")

    const healthCheck = readFileSync(resolve(process.cwd(), 'src/lib/health/checks/web.ts'), 'utf8')
    expect(healthCheck).toContain('npm run audit:browser')
  })
})
