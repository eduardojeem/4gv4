import { writeFile } from 'node:fs/promises'
import axe from 'axe-core'
import { chromium } from 'playwright'

const baseUrl = (process.env.BROWSER_AUDIT_BASE_URL || 'https://mitiendapy.com').replace(/\/$/, '')
const paths = ['/saas', '/marketplace', '/login', '/register']
const outputPath = process.env.BROWSER_AUDIT_OUTPUT

async function openBrowser() {
  try {
    return await chromium.launch({ headless: true })
  } catch (error) {
    if (process.platform !== 'win32') throw error
    return chromium.launch({ channel: 'chrome', headless: true })
  }
}

const browser = await openBrowser()
const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, bypassCSP: true })
const pages = []

try {
  for (const path of paths) {
    const page = await context.newPage()
    const consoleErrors = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    const startedAt = Date.now()
    let response = null
    let navigationError = null
    try {
      response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => undefined)
    } catch (error) {
      navigationError = error instanceof Error ? error.message : String(error)
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined)
    }
    const elapsedMs = Date.now() - startedAt
    const status = response?.status() ?? 0
    const title = await page.title().catch(() => '')
    const auditable = status >= 200 && status < 400

    let accessibility = null
    if (auditable) {
      await page.addScriptTag({ content: axe.source })
      accessibility = await page.evaluate(async () => globalThis.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      }))
    }

    const forms = auditable ? await page.locator('form').evaluateAll((elements) => elements.map((form) => {
      const controls = [...form.querySelectorAll('input:not([type="hidden"]), select, textarea')]
      const unlabeled = controls.filter((control) => {
        const id = control.getAttribute('id')
        return !control.getAttribute('aria-label')
          && !control.getAttribute('aria-labelledby')
          && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
          && !control.closest('label')
      })
      return {
        controls: controls.length,
        required: controls.filter((control) => control.hasAttribute('required') || control.getAttribute('aria-required') === 'true').length,
        unlabeled: unlabeled.length,
        validBeforeInteraction: form.checkValidity(),
      }
    })) : []

    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType('navigation')[0]
      if (!entry) return null
      return {
        ttfbMs: Math.round(entry.responseStart),
        domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
        loadMs: Math.round(entry.loadEventEnd),
        transferBytes: entry.transferSize,
      }
    })

    pages.push({
      path,
      status,
      title,
      elapsedMs,
      challenged: status === 403,
      navigationError,
      navigation,
      forms,
      accessibility: accessibility ? {
        available: true,
        violations: accessibility.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          nodes: violation.nodes.length,
          examples: violation.nodes.slice(0, 10).map((node) => ({
            target: node.target,
            html: node.html,
            failureSummary: node.failureSummary,
          })),
        })),
      } : {
        available: false,
        reason: 'La pagina devolvio un desafio o error HTTP; no se audita su HTML intermedio.',
        violations: [],
      },
      consoleErrors,
    })
    await page.close()
  }
} finally {
  await browser.close()
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  note: 'Auditoría anónima de solo lectura. Comprueba WCAG con axe y estructura/validación nativa; no envía formularios.',
  pages,
}

const json = `${JSON.stringify(report, null, 2)}\n`
if (outputPath) await writeFile(outputPath, json, 'utf8')
process.stdout.write(json)
