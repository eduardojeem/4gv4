import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { apiFetch } from './api';
import { avatarPath, avatarStoragePath } from './profile-model';
import { supabase } from './supabase';

/**
 * Foto de perfil, compartida entre «Mi perfil» del panel y «Editar perfil» del
 * marketplace: la misma carpeta del bucket (avatars/<user_id>/) y la misma API
 * (/api/dashboard/profile), que sirve para cualquier usuario, no solo personal.
 */

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Pide permiso, deja elegir o sacar la foto y la sube. null si el usuario canceló. */
export async function pickAndUploadAvatar(source: 'camera' | 'library', userId: string, previousUrl: string | null): Promise<string | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permiso necesario', source === 'camera'
      ? 'Habilitá la cámara en los ajustes del teléfono para sacarte una foto.'
      : 'Habilitá el acceso a tus fotos en los ajustes del teléfono para elegir una.');
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.uri) return null;
  if (asset.fileSize && asset.fileSize > AVATAR_MAX_BYTES) {
    Alert.alert('Imagen muy pesada', 'Elegí una foto de hasta 5 MB.');
    return null;
  }

  const mimeType = asset.mimeType === 'image/png' || asset.mimeType === 'image/webp' ? asset.mimeType : 'image/jpeg';
  const path = avatarPath(userId, mimeType);
  const body = await fetch(asset.uri).then((response) => response.arrayBuffer());
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: mimeType, cacheControl: '3600', upsert: false });
  if (error) throw new Error(error.message);
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  await apiFetch('/api/dashboard/profile', { method: 'PATCH', body: JSON.stringify({ avatarUrl: url }) });
  removeAvatarFile(previousUrl, userId);
  return url;
}

/** Quita la foto del perfil y borra el archivo si es de su carpeta. */
export async function removeAvatar(userId: string, currentUrl: string | null) {
  await apiFetch('/api/dashboard/profile', { method: 'PATCH', body: JSON.stringify({ avatarUrl: '' }) });
  removeAvatarFile(currentUrl, userId);
}

/** La foto anterior ya no se usa: se borra para no acumular archivos. */
function removeAvatarFile(url: string | null, userId: string) {
  const path = avatarStoragePath(url, userId);
  if (path) void supabase.storage.from('avatars').remove([path]).then(() => undefined, () => undefined);
}
