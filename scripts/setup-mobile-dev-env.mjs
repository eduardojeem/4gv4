import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { assertSafeDevelopmentEnvironment } from './dev-env-guard.mjs';

const repoRoot = process.cwd();
const localProject = join(process.env.LOCALAPPDATA ?? '', 'MiTiendaPy', 'mobile-dev-supabase');
const rootEnvPath = join(repoRoot, '.env.development.local');
const isWindows = process.platform === 'win32';

function runSupabase(args) {
  const command = isWindows ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['supabase', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: isWindows,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error('No se pudo consultar el Supabase local. Iniciá el stack aislado con npm run supabase:mobile:start.');
  }
  return result.stdout;
}

function readStatus() {
  const output = runSupabase(['status', '--workdir', localProject, '--output', 'json']);
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Supabase local no devolvió su estado JSON.');
  const status = JSON.parse(output.slice(start, end + 1));
  const apiUrl = new URL(status.API_URL);
  if (apiUrl.hostname !== '127.0.0.1' || apiUrl.port !== '55321') {
    throw new Error('El API Supabase no coincide con los puertos del stack DEV aislado.');
  }
  return status;
}

function currentLanIp() {
  if (process.env.DEV_LAN_IP) return process.env.DEV_LAN_IP;
  const candidates = Object.entries(networkInterfaces()).flatMap(([interfaceName, addresses]) =>
    (addresses ?? [])
      .filter((item) => item.family === 'IPv4' && !item.internal)
      .map((item) => ({ address: item.address, interfaceName })),
  ).filter(({ address }) => /^(192\.168\.|10\.)/.test(address));
  candidates.sort((a, b) => {
    const score = (candidate) => candidate.address.startsWith('192.168.') ? 0 : 1;
    return score(a) - score(b);
  });
  if (!candidates[0]) throw new Error('No encontré una IP LAN 192.168.x.x o 10.x.x.x. Definí DEV_LAN_IP con la IP local actual.');
  return candidates[0].address;
}

function assertLanIp(ip) {
  const octets = ip.split('.').map(Number);
  const privateLan = octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    && (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168));
  if (!privateLan) throw new Error('DEV_LAN_IP debe ser una IPv4 privada LAN (10.x o 192.168.x).');
}

function envText(values) {
  return Object.entries(values).map(([key, value]) => `${key}=${String(value ?? '').replace(/[\r\n]/g, '')}`).join('\n');
}

function mergeEnvFile(filePath, values, { requireMarker = false } = {}) {
  const marker = '# Managed by scripts/setup-mobile-dev-env.mjs';
  let lines = existsSync(filePath) ? readFileSync(filePath, 'utf8').split(/\r?\n/) : [];
  if (requireMarker && lines.length && !lines.includes(marker)) {
    throw new Error(`${filePath} ya existe y no está marcado como archivo generado; se preservó sin cambios.`);
  }
  const names = new Set(Object.keys(values));
  lines = lines.filter((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return !match || !names.has(match[1]);
  });
  lines = lines.filter((line, index) => line !== marker || lines.indexOf(marker) === index);
  const merged = [marker, ...lines.filter((line) => line.trim()), envText(values), ''].join('\n');
  writeFileSync(filePath, merged, { encoding: 'utf8' });
}

const status = readStatus();
const lanIp = currentLanIp();
assertLanIp(lanIp);
const apiUrl = `http://${lanIp}:3000`;
const supabaseLanUrl = `http://${lanIp}:55321`;
const existingRootEnv = existsSync(rootEnvPath) ? dotenv.parse(readFileSync(rootEnvPath)) : {};
const rootEnv = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_LOCALE: 'es-PY',
  NEXT_PUBLIC_CURRENCY: 'PYG',
  NEXT_PUBLIC_TAX_RATE: '0',
  NEXT_PUBLIC_PRICES_INCLUDE_TAX: 'false',
  PUBLIC_SESSION_SECRET: 'local-only-session-secret-for-mitiendapy-mobile-dev',
  CRON_SECRET: 'local-only-cron-secret-for-mitiendapy-mobile-dev',
  CRON_SECRETE: '',
  REPAIR_QR_SECRET: 'local-only-repair-secret-for-mitiendapy-mobile-dev',
  NEXT_PUBLIC_COMPANY_NAME: 'MiTiendaPy DEV',
  NEXT_PUBLIC_COMPANY_PHONE: '',
  NEXT_PUBLIC_COMPANY_ADDRESS: '',
  NEXT_PUBLIC_COMPANY_EMAIL: 'dev@example.test',
  NEXT_PUBLIC_COMPANY_RUC: '',
  NEXT_PUBLIC_SUPPORT_WHATSAPP: '',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
  APP_URL: 'http://localhost:3000',
  APP_ROOT_DOMAIN: 'localhost',
  NEXT_PUBLIC_BASE_DOMAIN: 'localhost',
  DEFAULT_PUBLIC_ORG_SLUG: 'demo',
  SUPPORT_MODE_ENFORCED: 'false',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
  TURNSTILE_SECRET_KEY: '',
  PAGOPAR_PUBLIC_KEY: '',
  PAGOPAR_PRIVATE_KEY: '',
  PAGOPAR_USD_TO_PYG: '7500',
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
  RESEND_API_KEY: '',
  EMAIL_FROM: 'MiTiendaPy DEV <dev@example.test>',
  EMAIL_REPLY_TO: 'dev@example.test',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  MOBILE_DEV_OWNER_EMAIL: 'mobile-owner@dev.example.test',
  MOBILE_DEV_TECH_EMAIL: 'mobile-tech@dev.example.test',
  MOBILE_DEV_TEST_PASSWORD: existingRootEnv.MOBILE_DEV_TEST_PASSWORD ?? randomBytes(24).toString('base64url'),
};
assertSafeDevelopmentEnvironment(rootEnv);

const mobileEnv = {
  EXPO_PUBLIC_RUNTIME_ENV: 'development',
  EXPO_PUBLIC_API_URL: apiUrl,
  EXPO_PUBLIC_SUPABASE_URL: supabaseLanUrl,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  EXPO_PUBLIC_SITE_URL: apiUrl,
};
mergeEnvFile(rootEnvPath, rootEnv, { requireMarker: true });
mergeEnvFile(join(repoRoot, 'mobile', '.env.local'), mobileEnv);
console.log('Entorno DEV generado: Next usa Supabase local; Expo usa la API LAN y Supabase local.');
console.log(`IP LAN actual detectada: ${lanIp}. Se vuelve a detectar cuando ejecutás este script.`);
