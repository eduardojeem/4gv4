'use client'

import imageCompression from 'browser-image-compression'

import {
  IMAGE_UPLOAD_PROFILES,
  replaceImageExtension,
  type ImageUploadProfileName,
} from './upload-profiles'

export async function optimizeImageFile(
  file: File,
  profileName: ImageUploadProfileName,
  onProgress?: (percent: number) => void,
): Promise<File> {
  const profile = IMAGE_UPLOAD_PROFILES[profileName]
  const compressed = await imageCompression(file, {
    maxSizeMB: Number((profile.targetBytes / (1024 * 1024)).toFixed(1)),
    maxWidthOrHeight: profile.maxDimension,
    fileType: profile.outputMime,
    useWebWorker: true,
    initialQuality: profile.initialQuality,
    onProgress,
  })

  return new File(
    [compressed],
    replaceImageExtension(file.name, profile.extension),
    {
      type: profile.outputMime,
      lastModified: Date.now(),
    },
  )
}
