import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { assertSafeDevelopmentEnvironment } from './dev-env-guard.mjs';

const envPath = resolve(process.cwd(), '.env.development.local');
let developmentEnv;
try {
  developmentEnv = dotenv.parse(readFileSync(envPath));
} catch {
  console.error('No existe .env.development.local. Ejecutá npm run mobile:dev:env luego de iniciar Supabase local.');
  process.exit(1);
}

// Next respeta las variables ya presentes en process.env. Aplicamos primero el
// entorno DEV validado para que .env.local (que puede contener producción) no
// complete ni reemplace estas credenciales durante npm run dev.
Object.assign(process.env, developmentEnv, { NODE_ENV: 'development' });

let supabaseUrl;
try {
  supabaseUrl = assertSafeDevelopmentEnvironment(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Entorno DEV rechazado por la protección Supabase.');
  process.exit(1);
}

const nextBin = resolve(process.cwd(), 'node_modules/next/dist/bin/next');
console.log(`Next.js DEV aislado: Supabase local ${supabaseUrl.hostname}:${supabaseUrl.port || '80'}`);
const child = spawn(process.execPath, [nextBin, 'dev', '--turbopack', '--hostname', '0.0.0.0', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', (error) => {
  console.error(`No se pudo iniciar Next.js DEV (${error.code ?? 'spawn error'}).`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
