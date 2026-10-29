/**
 * En CI no se instalan las dependencias de mobile/: los tests que importan
 * código de la app usan este reemplazo mínimo y cada uno lo redefine con
 * vi.mock('react-native') según lo que necesite.
 */
export const Platform = { OS: 'android', select: <T,>(options: { android?: T; default?: T }) => options.android ?? options.default }
export const AppState = { addEventListener: () => ({ remove: () => undefined }) }
export const Alert = { alert: () => undefined }
export const useColorScheme = () => 'light'
