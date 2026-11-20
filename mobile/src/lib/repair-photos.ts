import { Platform } from 'react-native';

import { ApiError, apiFetch } from './api';
import type { Repair } from './repairs';
import { formDataFile, type PickedImage } from './website-admin';

/** El mismo bucket y las mismas rutas que usa la web al subir fotos de una reparación. */
const REPAIR_IMAGE_BUCKET = 'repair-images';

const extensionFor = (mime: string) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');

/**
 * Sube una foto del equipo como la web: primero el archivo a /api/upload (que
 * controla el plan, el tipo y el tamaño, máx. 5 MB) y después la vincula a la
 * reparación (que controla el cupo de fotos del plan).
 */
export async function addRepairPhoto(repairId: string, image: PickedImage): Promise<Repair> {
  const mime = image.mimeType && /^image\/(jpeg|png|webp)$/.test(image.mimeType) ? image.mimeType : 'image/jpeg';
  const name = (image.fileName || `foto.${extensionFor(mime)}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const form = new FormData();
  const file = await formDataFile(image.uri, name, mime);
  if (Platform.OS === 'web') form.append('file', file, name);
  else form.append('file', file);
  form.append('bucket', REPAIR_IMAGE_BUCKET);
  form.append('path', `repairs/${repairId}/${Date.now()}-${name}`);

  const upload = await apiFetch<{ success?: boolean; path?: string; error?: string }>('/api/upload', { method: 'POST', body: form });
  if (!upload?.path) throw new ApiError(upload?.error || 'No se pudo subir la foto.', 500);

  const result = await apiFetch<{ repair: Repair }>(`/api/repairs/${encodeURIComponent(repairId)}/images`, {
    method: 'POST',
    body: JSON.stringify({ images: [{ storagePath: upload.path, imageType: 'general' }] }),
  });
  return result.repair;
}

/** Quita una foto de la reparación (y el archivo del almacenamiento). */
export async function removeRepairPhoto(repairId: string, imageId: string): Promise<Repair> {
  const result = await apiFetch<{ repair: Repair }>(`/api/repairs/${encodeURIComponent(repairId)}/images`, {
    method: 'DELETE',
    body: JSON.stringify({ imageId }),
  });
  return result.repair;
}
