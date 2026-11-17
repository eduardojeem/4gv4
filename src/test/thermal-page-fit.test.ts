import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { fitThermalPage, fitThermalPageScript, rollWidthForContent, thermalPageCss, thermalPageHeightMm, THERMAL_PAGE_STYLE_ID } from '@/lib/printing/thermal-page'

describe('largo de página para impresoras térmicas', () => {
  it('convierte la altura del contenido a mm con margen de seguridad y límites', () => {
    expect(thermalPageHeightMm(377)).toBe(108) // 377 px ≈ 99,75 mm → 100 + 8
    expect(thermalPageHeightMm(10)).toBe(60) // mínimo
    expect(thermalPageHeightMm(1_000_000)).toBe(3000) // máximo
  })

  it('arma el tamaño exacto, sin «auto» (que Chrome ignora)', () => {
    expect(thermalPageCss(80, 142)).toBe('@page{size:80mm 142mm}')
    expect(rollWidthForContent(48)).toBe(58)
    expect(rollWidthForContent(72)).toBe(80)
  })

  it('agrega el estilo al documento una sola vez y lo actualiza', () => {
    const doc = document.implementation.createHTMLDocument('ticket')
    Object.defineProperty(doc.documentElement, 'scrollHeight', { configurable: true, value: 566 })
    expect(fitThermalPage(doc, 80)).toBe(158)
    fitThermalPage(doc, 58)
    const styles = doc.querySelectorAll(`#${THERMAL_PAGE_STYLE_ID}`)
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toBe('@page{size:58mm 158mm}')
  })

  it('el script para las plantillas que se imprimen solas hace lo mismo', () => {
    const doc = document.implementation.createHTMLDocument('ticket')
    Object.defineProperty(doc.documentElement, 'scrollHeight', { configurable: true, value: 566 })
    new Function('document', fitThermalPageScript(80))(doc)
    expect(doc.getElementById(THERMAL_PAGE_STYLE_ID)?.textContent).toBe('@page{size:80mm 158mm}')
  })

  it('sin documento no rompe la impresión', () => {
    expect(fitThermalPage(null, 80)).toBeNull()
  })
})

describe('dónde se aplica', () => {
  const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')
  it('pedidos, POS y reparaciones fijan el largo antes de imprimir en rollo', () => {
    expect(read('src/components/dashboard/orders/OrderReceiptPrintButton.tsx')).toContain("if (paper !== 'A4') fitThermalPage(frame.contentDocument")
    expect(read('src/lib/receipt-utils.ts')).toContain('fitThermalPage(printWindow.document, 80)')
    const repair = read('src/lib/repair-receipt.ts')
    expect(repair).toContain("const thermalFit = isA4 ? '' : fitThermalPageScript(")
    expect(repair.match(/\$\{thermalFit\}window\.print\(\)/g)).toHaveLength(3)
  })
})
