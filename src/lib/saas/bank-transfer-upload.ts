export const MAX_TRANSFER_RECEIPT_BYTES = 3 * 1024 * 1024
export const MAX_TRANSFER_MULTIPART_BYTES = MAX_TRANSFER_RECEIPT_BYTES + 64 * 1024

export function detectTransferReceiptType(bytes: Uint8Array): { mimeType: string; extension: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mimeType: 'image/jpeg', extension: 'jpg' }
  const png = [137, 80, 78, 71, 13, 10, 26, 10]
  if (png.every((value, index) => bytes[index] === value)) return { mimeType: 'image/png', extension: 'png' }
  if (new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') return { mimeType: 'application/pdf', extension: 'pdf' }
  return null
}

/** Count streamed bytes instead of trusting Content-Length or buffering an unbounded multipart body. */
export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array> {
  if (!body) throw new Error('El archivo está vacío.')
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new Error('El archivo es demasiado grande.')
      }
      chunks.push(result.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return bytes
}
