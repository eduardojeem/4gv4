/** Explicit opt-in: local UI + existing real database. Never runs seed/migrations. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const mode = process.argv[2];
const envIndex = process.argv.indexOf('--env-file');
if (!['web', 'expo'].includes(mode) || envIndex < 0 || !process.argv[envIndex + 1] || !process.argv.includes('--allow-real-data')) {
  throw new Error('Uso: node scripts/dev-real-data.mjs web|expo --env-file RUTA --allow-real-data');
}
const config = dotenv.parse(readFileSync(resolve(process.argv[envIndex + 1])));
const productionOrigin = 'https://cswtugmwazxdktntndpy.supabase.co';
if (config.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== productionOrigin || !config.NEXT_PUBLIC_SUPABASE_ANON_KEY || !config.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('La configuración debe corresponder al proyecto real conocido y tener sus credenciales completas.');
}
const host = Object.values(networkInterfaces()).flat().find(address => address?.family === 'IPv4' && !address.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(address.address))?.address;
if (!host) throw new Error('No se encontró una dirección LAN para el teléfono.');
const api = 'http://' + host + ':3000';
const env = mode === 'web' ? { ...process.env, ...config, NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: api } : {
  ...process.env,
  EXPO_PUBLIC_RUNTIME_ENV: 'real-data', EXPO_PUBLIC_ALLOW_REAL_DATA: 'yes',
  EXPO_PUBLIC_API_URL: api, EXPO_PUBLIC_SITE_URL: api,
  EXPO_PUBLIC_SUPABASE_URL: productionOrigin,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  REACT_NATIVE_PACKAGER_HOSTNAME: host,
  EXPO_NO_TELEMETRY: '1',
};
const root = process.cwd();
const args = mode === 'web'
  ? [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '0.0.0.0', '--port', '3000']
  : [resolve(root, 'mobile/node_modules/expo/bin/cli'), 'start', '--go', '--lan', '--port', '8081'];
console.log('REAL DATA: lo que guardes afecta datos reales. No se ejecutan seeds ni migraciones.');
console.log(mode === 'web' ? 'Web/API: ' + api : 'Expo Go: exp://' + host + ':8081; API: ' + api);
const child = spawn(process.execPath, args, { cwd: mode === 'web' ? root : resolve(root, 'mobile'), env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error('No se pudo iniciar: ' + error.code); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
