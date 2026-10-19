import { describe, expect, it } from 'vitest'
import { detectTransferReceiptType, MAX_TRANSFER_RECEIPT_BYTES, readBoundedBody } from './bank-transfer-upload'

describe('comprobantes privados de transferencias SaaS', () => {
  it('identifica los formatos por su contenido y rechaza HTML/SVG o archivos vacíos', () => {
    expect(detectTransferReceiptType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ mimeType: 'image/jpeg', extension: 'jpg' })
    expect(detectTransferReceiptType(new Uint8Array([137,80,78,71,13,10,26,10]))).toEqual({ mimeType: 'image/png', extension: 'png' })
    expect(detectTransferReceiptType(new TextEncoder().encode('%PDF-1.7\n'))).toEqual({ mimeType: 'application/pdf', extension: 'pdf' })
    expect(detectTransferReceiptType(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull()
    expect(detectTransferReceiptType(new Uint8Array())).toBeNull()
  })
  it('limita el cuerpo transmitido aunque Content-Length falte o sea falso', async () => {
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(8)); controller.enqueue(new Uint8Array(8)); controller.close() } })
    await expect(readBoundedBody(body, 10)).rejects.toThrow('demasiado grande')
    expect(MAX_TRANSFER_RECEIPT_BYTES).toBeLessThan(4_500_000)
  })
  it('admite un cuerpo completo dentro del límite', async () => {
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1,2,3])); controller.close() } })
    expect(await readBoundedBody(body, 10)).toEqual(new Uint8Array([1,2,3]))
  })
})
