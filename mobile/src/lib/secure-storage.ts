import * as SecureStore from 'expo-secure-store';

/**
 * Dónde guarda Supabase la sesión: en el llavero cifrado del teléfono
 * (Keychain en iOS, Keystore en Android), no en una base sin cifrar.
 *
 * Es una app de punto de venta: si se pierde o se presta el teléfono, el token
 * guardado da acceso al comercio. SecureStore recomienda valores de hasta 2 KB y
 * una sesión ocupa más, así que se parte en pedazos.
 */

const CHUNK = 1800;
const countKey = (key: string) => `${key}.chunks`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;
// SecureStore solo acepta letras, números, «.», «-» y «_».
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function removeChunks(key: string) {
  const count = Number((await SecureStore.getItemAsync(countKey(key))) ?? 0);
  await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))));
  await SecureStore.deleteItemAsync(countKey(key));
}

export const secureStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = safe(rawKey);
    const count = Number((await SecureStore.getItemAsync(countKey(key))) ?? 0);
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))));
    // Si falta un pedazo la sesión está rota: mejor pedir login que mandar basura.
    return parts.every((part) => part !== null) ? parts.join('') : null;
  },
  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safe(rawKey);
    await removeChunks(key);
    const parts: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
    if (parts.length === 0) parts.push('');
    await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(chunkKey(key, i), part)));
    await SecureStore.setItemAsync(countKey(key), String(parts.length));
  },
  async removeItem(rawKey: string): Promise<void> {
    await removeChunks(safe(rawKey));
  },
};
