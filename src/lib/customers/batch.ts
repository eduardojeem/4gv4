export function chunkIds(ids: string[], size: number): string[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error('El tamaño del lote debe ser positivo.')
  const uniqueIds = [...new Set(ids)]
  const chunks: string[][] = []
  for (let index = 0; index < uniqueIds.length; index += size) {
    chunks.push(uniqueIds.slice(index, index + size))
  }
  return chunks
}
