type SecureDeletion = { deleteItemAsync: (key: string) => Promise<void> };
const LEGACY_KEYS = ['mt_bio_pass', 'mt_bio_email', 'mt_bio_enabled'] as const;
/** Remove the former saved-password shortcut without reading its contents. */
export async function clearLegacyBiometricCredentials(storage: SecureDeletion): Promise<void> {
  await Promise.all(LEGACY_KEYS.map(key => storage.deleteItemAsync(key)));
}
