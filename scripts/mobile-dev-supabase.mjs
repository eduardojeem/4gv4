import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const localProject = join(process.env.LOCALAPPDATA ?? '', 'MiTiendaPy', 'mobile-dev-supabase');
const localSupabaseDir = join(localProject, 'supabase');
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const localMigrationCopies = [
  ['01_guard_product_cost_writes.sql', '20261020000100_s1_guard_product_cost_writes.sql'],
  ['04_s1b_customer_and_internal_costs.sql', '20261020000200_s1b_customer_and_internal_costs.sql'],
];

function runCli(args, { quiet = false } = {}) {
  const result = spawnSync(command, ['supabase', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    if (!quiet) {
      const details = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
        .split(/\r?\n/)
        .filter((line) => /error|fail|invalid|conflict|timeout|migration/i.test(line))
        .map((line) => line.replace(/eyJ[A-Za-z0-9_.-]+/g, '[REDACTED]'))
        .slice(-8);
      if (details.length) console.error(details.join('\n'));
    }
    throw new Error(`Supabase local command failed: ${args[0]}. No remote command was run.`);
  }
  return result.stdout ?? '';
}

function ensureIsolatedProject() {
  const sourceConfig = join(repoRoot, 'supabase', 'config.toml');
  const sourceMigrations = join(repoRoot, 'supabase', 'migrations');
  const targetMigrations = join(localSupabaseDir, 'migrations');
  mkdirSync(targetMigrations, { recursive: true });

  const targetConfig = join(localSupabaseDir, 'config.toml');
  if (!existsSync(targetConfig)) {
    let config = readFileSync(sourceConfig, 'utf8').replace(/^project_id\s*=.*$/m, 'project_id = "mitiendapy-mobile-dev"');
    config += '\n[api]\nport = 55321\n\n[db]\nport = 55322\n\n[studio]\nport = 55323\n\n[inbucket]\nport = 55324\n';
    writeFileSync(targetConfig, config, 'utf8');
  }

  const config = readFileSync(targetConfig, 'utf8').replace(/\r\n/g, '\n');
  if (!config.includes('project_id = "mitiendapy-mobile-dev"')
    || !config.includes('[api]\nport = 55321')
    || !config.includes('[db]\nport = 55322')) {
    throw new Error('La configuración Supabase aislada no coincide con el proyecto y puertos DEV esperados.');
  }
  if (existsSync(join(localSupabaseDir, '.temp', 'project-ref'))) {
    throw new Error('El stack local aislado aparece vinculado a un proyecto remoto; se detuvo sin modificarlo.');
  }

  for (const file of readdirSync(sourceMigrations).filter((name) => name.endsWith('.sql'))) {
    const destination = join(targetMigrations, file);
    if (!existsSync(destination)) copyFileSync(join(sourceMigrations, file), destination);
  }
  for (const [sourceName, destinationName] of localMigrationCopies) {
    const destination = join(targetMigrations, destinationName);
    const source = join(repoRoot, 'supabase', 'pending-migrations', 's1-product-cost', sourceName);
    if (!existsSync(destination)) copyFileSync(source, destination);
  }
}

const action = process.argv[2] ?? 'start';
if (action === 'stop') {
  if (!existsSync(join(localSupabaseDir, 'config.toml'))) {
    console.log('El stack Supabase móvil aislado no está configurado.');
    process.exit(0);
  }
  runCli(['stop', '--project-id', 'mitiendapy-mobile-dev', '--workdir', localProject], { quiet: true });
  console.log('Stack Supabase móvil DEV detenido; los datos locales se conservaron.');
  process.exit(0);
}

if (action !== 'start') throw new Error('Uso: node scripts/mobile-dev-supabase.mjs [start|stop]');
ensureIsolatedProject();
runCli(['start', '--exclude', 'logflare,vector', '--workdir', localProject], { quiet: true });
runCli(['migration', 'up', '--local', '--workdir', localProject], { quiet: true });
const verificationSql = join(localSupabaseDir, 'verify-s1-local.sql');
writeFileSync(verificationSql, "select public.has_product_cost_access(null::uuid, 'products.read_cost') is not null as s1_ready;\n", 'utf8');
runCli(['db', 'query', '--local', '--workdir', localProject, '--file', verificationSql], { quiet: true });
// Las imágenes del sitio web (logo, banners) se suben por el servidor a este bucket
// público, que en producción no viene de una migración. Sin políticas nuevas: la
// subida la hace la API con su cliente de servidor, no el usuario.
const bucketSql = join(localSupabaseDir, 'ensure-product-images-bucket.sql');
writeFileSync(bucketSql, `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
`, 'utf8');
runCli(['db', 'query', '--local', '--workdir', localProject, '--file', bucketSql], { quiet: true });
// La configuración global (la base de /api/settings/shared) tampoco viene de una
// migración: sin esta fila, Configuración falla en la web y en la app. Solo se
// crea si falta; nunca pisa la que ya exista.
const systemSettingsSql = join(localSupabaseDir, 'ensure-system-settings.sql');
writeFileSync(systemSettingsSql, `insert into public.system_settings (id, company_name, company_email, company_phone)
values ('system', 'MiTiendaPy DEV', 'dev@dev.example.test', '')
on conflict (id) do nothing;
`, 'utf8');
runCli(['db', 'query', '--local', '--workdir', localProject, '--file', systemSettingsSql], { quiet: true });
const envSetup = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'setup-mobile-dev-env.mjs')], {
  cwd: repoRoot,
  env: process.env,
  encoding: 'utf8',
  windowsHide: true,
});
if (envSetup.error || envSetup.status !== 0) throw new Error('No se pudieron generar los archivos locales de entorno DEV.');
if (envSetup.stdout) process.stdout.write(envSetup.stdout);
console.log('Supabase local aislado listo; migraciones locales, 01 y 04 aplicadas; bucket product-images y configuración global disponibles.');
