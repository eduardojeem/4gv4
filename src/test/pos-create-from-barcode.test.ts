import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(__dirname, '../app/dashboard/pos/page.tsx'), 'utf8')

describe('POS: código escaneado que no está cargado', () => {
  it('con el lector, el aviso ofrece crear el producto con ese código', () => {
    expect(page).toContain("if (result === null) notifyBarcodeNotFound(barcode)")
    expect(page).toContain("action: { label: 'Crear con este código', onClick: () => openQuickItemWithBarcode(barcode) }")
  })

  it('con la cámara, se cierra y abre el alta rápida con el código puesto', () => {
    expect(page).toContain('onScan={scanWithCamera}')
    expect(page).toMatch(/openQuickItemWithBarcode\(barcode\)\s+return \{ text: `«\$\{barcode\}» no está cargado: completá nombre y precio`, close: true \}/)
  })

  it('el item rápido guarda el código para que el próximo escaneo lo encuentre', () => {
    expect(page).toContain('barcode: quickItemBarcode,')
    expect(page).toContain('id="quick-item-barcode"')
  })
})
