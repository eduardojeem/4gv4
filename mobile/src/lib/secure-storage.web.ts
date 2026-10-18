/**
 * Expo SecureStore sólo funciona en Android/iOS. En la versión web se usa
 * almacenamiento de sesión por pestaña; el render del servidor no conserva
 * credenciales en memoria compartida entre peticiones.
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(key);
  },
};
