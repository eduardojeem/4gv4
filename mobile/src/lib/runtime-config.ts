export type MobileRuntimeConfigInput = {
  apiUrl?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  siteUrl?: string;
  development: boolean;
  runtimeEnvironment?: string;
};

const PRODUCTION_WEB_HOSTS = new Set(['www.mitiendapy.com', 'mitiendapy.com']);
const PRODUCTION_SUPABASE_HOST = 'cswtugmwazxdktntndpy.supabase.co';
const RUNTIME_ENVIRONMENTS = new Set(['development', 'preview', 'production']);

function parseUrl(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} no está configurada. Ejecutá el setup del entorno móvil local.`);
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} no contiene una URL válida.`);
  }
}

function isPrivateLanHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host.startsWith('127.')) return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

export function resolveMobileRuntimeConfig(input: MobileRuntimeConfigInput) {
  const apiUrl = parseUrl(input.apiUrl, 'EXPO_PUBLIC_API_URL');
  const supabaseUrl = parseUrl(input.supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL');
  const siteUrl = input.siteUrl ? parseUrl(input.siteUrl, 'EXPO_PUBLIC_SITE_URL') : apiUrl;

  if (apiUrl.protocol !== 'http:' && apiUrl.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL debe usar HTTP o HTTPS.');
  }
  if (supabaseUrl.protocol !== 'http:' && supabaseUrl.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL debe usar HTTP o HTTPS.');
  }
  if (!input.supabaseKey?.trim()) {
    throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no está configurada.');
  }

  const environment = input.runtimeEnvironment ?? (input.development ? 'development' : 'production');
  if (!RUNTIME_ENVIRONMENTS.has(environment)) {
    throw new Error('EXPO_PUBLIC_RUNTIME_ENV debe ser development, preview o production.');
  }

  if (environment === 'development' || input.development) {
    for (const [name, url] of [
      ['API', apiUrl],
      ['Supabase', supabaseUrl],
      ['sitio', siteUrl],
    ] as const) {
      if (url.protocol !== 'http:' || !isPrivateLanHost(url.hostname)) {
        throw new Error(`Entorno Expo DEV rechazado: ${name} debe apuntar a una dirección local/LAN por HTTP.`);
      }
    }
  } else if (environment === 'preview') {
    for (const [name, url] of [['API', apiUrl], ['Supabase', supabaseUrl], ['sitio', siteUrl]] as const) {
      if (url.protocol !== 'https:'
        || PRODUCTION_WEB_HOSTS.has(url.hostname.toLowerCase())
        || url.hostname.toLowerCase() === PRODUCTION_SUPABASE_HOST) {
        throw new Error(`Entorno Expo PREVIEW rechazado: ${name} requiere una URL HTTPS de pruebas separada de producción.`);
      }
    }
  } else if (environment === 'production') {
    if (apiUrl.protocol !== 'https:' || !PRODUCTION_WEB_HOSTS.has(apiUrl.hostname.toLowerCase())) {
      throw new Error('Entorno Expo PRODUCTION rechazado: EXPO_PUBLIC_API_URL debe usar un dominio web productivo de MiTiendaPy.');
    }
    if (siteUrl.protocol !== 'https:' || !PRODUCTION_WEB_HOSTS.has(siteUrl.hostname.toLowerCase())) {
      throw new Error('Entorno Expo PRODUCTION rechazado: EXPO_PUBLIC_SITE_URL debe usar un dominio web productivo de MiTiendaPy.');
    }
    if (supabaseUrl.protocol !== 'https:' || supabaseUrl.hostname.toLowerCase() !== PRODUCTION_SUPABASE_HOST) {
      throw new Error('Entorno Expo PRODUCTION rechazado: EXPO_PUBLIC_SUPABASE_URL debe usar el proyecto Supabase productivo.');
    }
  }

  return {
    apiUrl: apiUrl.toString().replace(/\/$/, ''),
    supabaseUrl: supabaseUrl.toString().replace(/\/$/, ''),
    supabaseKey: input.supabaseKey,
    siteUrl: siteUrl.toString().replace(/\/$/, ''),
    environment,
  };
}

export function getMobileRuntimeConfig() {
  return resolveMobileRuntimeConfig({
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    siteUrl: process.env.EXPO_PUBLIC_SITE_URL,
    development: typeof __DEV__ !== 'undefined' && __DEV__,
    runtimeEnvironment: process.env.EXPO_PUBLIC_RUNTIME_ENV,
  });
}
