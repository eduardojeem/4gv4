import sharp from 'sharp'

import {
  IMAGE_UPLOAD_PROFILES,
  replaceImageExtension,
  type ImageUploadProfileName,
} from './upload-profiles'

export interface OptimizedServerImage {
  buffer: Buffer
  mimeType: string
  extension: string
  fileName: string
  width?: number
  height?: number
}

const PASSTHROUGH_FORMATS = {
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
} as const

const RASTER_FORMATS: Record<string, string[]> = {
  'image/jpeg': ['jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/avif': ['heif', 'avif'],
}

async function validatedMetadata(input: Buffer, inputMime: string) {
  try {
    const metadata = await sharp(input, { animated: inputMime === 'image/gif' }).metadata()
    const acceptedFormats = inputMime in PASSTHROUGH_FORMATS
      ? [PASSTHROUGH_FORMATS[inputMime as keyof typeof PASSTHROUGH_FORMATS]]
      : RASTER_FORMATS[inputMime]

    if (!metadata.format || !acceptedFormats?.includes(metadata.format)) {
      throw new Error('El contenido no coincide con el tipo de imagen declarado.')
    }
    return metadata
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'formato desconocido'
    throw new Error(`No se pudo decodificar la imagen: ${reason}`)
  }
}

export async function optimizeServerImage(
  input: Buffer,
  inputMime: string,
  originalName: string,
  profileName: ImageUploadProfileName,
): Promise<OptimizedServerImage> {
  const metadata = await validatedMetadata(input, inputMime)
  const passthroughExtension = PASSTHROUGH_FORMATS[inputMime as keyof typeof PASSTHROUGH_FORMATS]

  if (passthroughExtension) {
    return {
      buffer: input,
      mimeType: inputMime,
      extension: passthroughExtension,
      fileName: replaceImageExtension(originalName, passthroughExtension),
      width: metadata.width,
      height: metadata.height,
    }
  }

  const profile = IMAGE_UPLOAD_PROFILES[profileName]
  const initialQuality = Math.round(profile.initialQuality * 100)
  const minimumQuality = Math.round(profile.minimumQuality * 100)
  const qualities: number[] = []
  for (let quality = initialQuality; quality >= minimumQuality; quality -= 10) {
    qualities.push(Math.max(quality, minimumQuality))
  }
  if (qualities.at(-1) !== minimumQuality) qualities.push(minimumQuality)

  let output = input
  for (const quality of qualities) {
    output = await sharp(input)
      .rotate()
      .resize(profile.maxDimension, profile.maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer()
    if (output.byteLength <= profile.targetBytes) break
  }

  const outputMetadata = await sharp(output).metadata()
  return {
    buffer: output,
    mimeType: profile.outputMime,
    extension: profile.extension,
    fileName: replaceImageExtension(originalName, profile.extension),
    width: outputMetadata.width,
    height: outputMetadata.height,
  }
}
