// Local browser/driver-width regression. Uses synthetic data, never a real payment.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { chromium } = require('playwright')

async function main() {
  const executablePath = process.env.CREDIT_PRINT_BROWSER_PATH
  const pdfjsPath = process.env.CREDIT_PRINT_PDFJS_PATH
  if (!executablePath || !pdfjsPath) throw new Error('Set CREDIT_PRINT_BROWSER_PATH and CREDIT_PRINT_PDFJS_PATH for local verification.')
  const outputDir = path.resolve(process.env.CREDIT_PRINT_ARTIFACT_DIR || 'test-results/credit-print')
  await fs.mkdir(outputDir, { recursive: true })
  const pdfjs = await import(pathToFileURL(pdfjsPath).href)
  let browser
  try {
    // Produced by the real generators in thermal-print.test.ts with the same
    // CREDIT_PRINT_ARTIFACT_DIR, avoiding a separate implementation of totals.
    const html = await fs.readFile(path.join(outputDir, 'ticket-80mm.html'), 'utf8')
    browser = await chromium.launch({ executablePath, headless: true })
    const page = await browser.newPage()
    const results = []
    for (const width of [80, 72, 64, 58]) {
      await page.setViewportSize({ width: Math.round(width * 96 / 25.4), height: 900 })
      await page.setContent(html)
      await page.emulateMedia({ media: 'print' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      assert.equal(overflow, false, `horizontal DOM overflow at ${width}mm`)
      const buffer = await page.pdf({ width: `${width}mm`, height: '200mm', printBackground: true, preferCSSPageSize: false })
      await fs.writeFile(path.join(outputDir, `ticket-area-${width}mm.pdf`), buffer)
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise
      let text = ''
      let maxRightMm = 0
      for (let number = 1; number <= pdf.numPages; number++) {
        const pdfPage = await pdf.getPage(number)
        const content = await pdfPage.getTextContent()
        for (const item of content.items) {
          if (!('str' in item)) continue
          const right = item.transform[4] + item.width
          assert.ok(item.transform[4] >= -0.5 && right <= pdfPage.view[2] + 0.5, `clipped text at ${width}mm: ${item.str}`)
          maxRightMm = Math.max(maxRightMm, right * 25.4 / 72)
          text += item.str + ' '
        }
      }
      assert.match(text, /FINAL_NOTAS/)
      assert.match(text, /375\.000/)
      assert.match(text, /Conserve este comprobante/)
      const compactText = text.replace(/\s+/g, '')
      assert.ok(compactText.includes('REFERENCIASINESPACIOS'.repeat(12)), `incomplete reference at ${width}mm`)
      assert.equal((compactText.match(/Observacióndeprueba/g) || []).length, 50, `missing notes at ${width}mm`)
      assert.equal((compactText.match(/Productoyaccesorioscondescripciónextensa/g) || []).length, 12, `missing product description at ${width}mm`)
      results.push({ widthMm: width, pages: pdf.numPages, maxRightMm, complete: true })
      await pdf.destroy()
    }
    await page.setViewportSize({ width: 360, height: 1000 })
    await page.screenshot({ path: path.join(outputDir, 'ticket-preview.png'), fullPage: true })
    await fs.writeFile(path.join(outputDir, 'results.json'), JSON.stringify(results, null, 2))
    console.log(JSON.stringify({ browser: await browser.version(), results, outputDir }))
  } finally {
    await browser?.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
