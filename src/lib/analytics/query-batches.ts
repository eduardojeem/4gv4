export function chunkQueryValues<T>(values: T[], batchSize = 500): T[][] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('batchSize must be a positive integer')
  }

  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += batchSize) {
    chunks.push(values.slice(index, index + batchSize))
  }
  return chunks
}
