import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_RECEIPT_SETTINGS,
  generateRepairShareText,
  getReceiptSettings,
  patchReceiptSettings,
  printRepairReceipt,
  refreshReceiptSettings,
  resetReceiptSettingsSyncForTests,
  subscribeReceiptSettings,
  type RepairPrintPayload,
  type RepairReceiptSettings,
} from '@/lib/repair-receipt'

const orden = (extra: Partial<RepairPrintPayload>): RepairPrintPayload => ({
  ticketNumber: 'R-1',
  date: new Date('2026-09-13T15:00:00.000Z'),
  customer: { name: 'Ana' },
  devices: [{ typeLabel: 'Celular', brand: 'Samsung', model: 'A54', issue: 'Pantalla' }],
  ...extra,
})

function imprimir(payload: RepairPrintPayload, settings: Partial<RepairReceiptSettings> = {}) {
  let html = ''
  vi.spyOn(window, 'open').mockReturnValue({
    document: { write: (h: string) => { html = h }, close: () => {} },
    closed: false,
    focus: () => {},
  } as unknown as Window)
  printRepairReceipt('customer', payload, '80mm', { ...DEFAULT_RECEIPT_SETTINGS, defaultWarrantyMonths: 3, ...settings })
  const inicio = html.indexOf('warranty-text')
  return html.slice(inicio, html.indexOf('</div>', inicio)).replace(/\s+/g, ' ')
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('el renglón de garantía del comprobante', () => {
  /**
   * Por precedencia de operadores, cualquier tipo salía como «Mano de obra»:
   * una garantía completa quedaba firmada como si cubriera solo el trabajo.
   */
  it.each([
    ['full', 'mano de obra y repuestos'],
    ['labor', 'solo mano de obra'],
    ['parts', 'solo repuestos'],
  ] as const)('una garantía %s dice lo que cubre', (tipo, texto) => {
    const renglon = imprimir(orden({ warrantyMonths: 6, warrantyType: tipo }))
    expect(renglon).toContain(`6 meses (${texto})`)
  })

  /** Las órdenes del modo rápido se guardan con 0 y salían con 3 meses. */
  it('una orden sin garantía no imprime la del taller', () => {
    const renglon = imprimir(orden({ warrantyMonths: 0, warrantyNotes: 'resto viejo' }))
    expect(renglon).toContain('Esta reparación no incluye garantía.')
    expect(renglon).not.toContain('3 meses')
    expect(renglon).not.toContain('resto viejo')
    expect(renglon).not.toContain('humedad')
  })

  it('una orden sin datos de garantía usa la del taller', () => {
    expect(imprimir(orden({}))).toContain('Garantía:</strong> 3 meses (mano de obra y repuestos)')
  })

  it('dice «1 mes», no «1 meses»', () => {
    expect(imprimir(orden({ warrantyMonths: 1, warrantyType: 'full' }))).toContain('1 mes (')
  })

  /** Quien agregaba la cláusula con los botones la veía impresa dos veces. */
  it('no repite las cláusulas que ya están en el texto legal', () => {
    const renglon = imprimir(orden({ warrantyMonths: 3, warrantyType: 'full' }), {
      legalText: 'Pasados los 90 días de la notificación, el equipo se considerará abandonado.',
    })
    expect(renglon).not.toContain('90 días')
    expect(renglon).toContain('Es indispensable presentar este comprobante')
  })

  it('el texto para compartir nombra la cobertura y la duración igual', () => {
    const texto = generateRepairShareText(orden({ warrantyMonths: 12, warrantyType: 'parts' }))
    expect(texto).toContain('*Garantía:* 1 año, solo repuestos')
  })
})

describe('la copia del navegador se mantiene al día', () => {
  const respuesta = (data: Partial<RepairReceiptSettings>, extra: Record<string, unknown> = {}) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { ...DEFAULT_RECEIPT_SETTINGS, ...data }, organizationId: 'org-1', persisted: true, canEdit: true, ...extra }),
  })

  beforeEach(() => {
    localStorage.clear()
    resetReceiptSettingsSyncForTests()
  })

  it('refrescar guarda lo del servidor donde imprimen el detalle y el listado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta({ paperFormat: 'A4' })))

    const snapshot = await refreshReceiptSettings()

    expect(snapshot?.settings.paperFormat).toBe('A4')
    expect(getReceiptSettings().paperFormat).toBe('A4')
  })

  it('no vuelve a pedir en menos de un minuto, salvo que se fuerce', async () => {
    const fetchMock = vi.fn(async () => respuesta({}))
    vi.stubGlobal('fetch', fetchMock)

    await refreshReceiptSettings()
    await refreshReceiptSettings()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await refreshReceiptSettings({ force: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('dos pedidos a la vez comparten la misma llamada', async () => {
    const fetchMock = vi.fn(async () => respuesta({}))
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([refreshReceiptSettings({ force: true }), refreshReceiptSettings({ force: true })])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('guardar manda solo el cambio, por PATCH, y actualiza la copia local', async () => {
    const fetchMock = vi.fn(async () => respuesta({ defaultWarrantyMonths: 12 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await patchReceiptSettings({ defaultWarrantyMonths: 12 })

    expect(result.ok).toBe(true)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ settings: { defaultWarrantyMonths: 12 } })
    expect(getReceiptSettings().defaultWarrantyMonths).toBe(12)
  })

  it('un 403 se explica', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })))
    const result = await patchReceiptSettings({ showHash: false })
    expect(result).toMatchObject({ ok: false, status: 403, error: 'Solo un administrador puede cambiar esta configuración.' })
  })

  it('avisa a las pantallas abiertas cuando otra pestaña guarda', () => {
    const listener = vi.fn()
    const cancelar = subscribeReceiptSettings(listener)

    localStorage.setItem('4g_repair_receipt_settings:org-1', JSON.stringify({ ...DEFAULT_RECEIPT_SETTINGS, paperFormat: '58mm' }))
    localStorage.setItem('4g_repair_receipt_settings_active_org', 'org-1')
    window.dispatchEvent(new StorageEvent('storage', { key: '4g_repair_receipt_settings:org-1' }))

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].paperFormat).toBe('58mm')

    cancelar()
    window.dispatchEvent(new StorageEvent('storage', { key: '4g_repair_receipt_settings:org-1' }))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
