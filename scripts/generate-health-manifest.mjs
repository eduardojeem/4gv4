#!/usr/bin/env node
/**
 * Genera src/lib/health/generated/code-audit.json para /superadmin/system-health.
 *
 * En Vercel el código fuente no existe en runtime, así que las comprobaciones
 * que dependen del código (rate limiting por endpoint, guardias de rutas
 * admin, páginas legales, secretos referenciados desde Client Components) se
 * calculan acá, antes de `next build` (script `prebuild`). El JSON se commitea
 * para que `next dev` también lo tenga; `generatedAt` le dice al panel qué tan
 * reciente es.
 *
 * Es un análisis heurístico por texto: el panel lo presenta como "detectado en
 * el código", nunca como garantía.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const APP = path.join(SRC, 'app')
const OUT = path.join(SRC, 'lib', 'health', 'generated', 'code-audit.json')

function walk(dir, filter, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, filter, acc)
    else if (filter(full)) acc.push(full)
  }
  return acc
}

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/')
const read = (file) => fs.readFileSync(file, 'utf8')

function routeFromFile(file) {
  const relative = path.relative(APP, path.dirname(file)).split(path.sep).join('/')
  const segments = relative
    .split('/')
    .filter((segment) => segment && !/^\(.*\)$/.test(segment))
  return `/${segments.join('/')}`
}

const METHOD_RE = /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g
const EFFECTIVE_RATE_LIMIT_RE = /await\s+(?:\(\s*)?(?:rateLimiter\.check|checkRateLimit)\s*\(|withRateLimit\s*\(/i
const TURNSTILE_RE = /turnstile|captchaToken/i
const SUPERADMIN_GUARD_RE = /getSuperAdminUser|requireSuperAdmin|withSuperAdminAuth/
const AUTH_GUARD_RE =
  /getSuperAdminUser|requireSuperAdmin|with[A-Za-z]*Auth\b|require(Staff|Auth|Admin|User|Permission|Org[A-Za-z]*)|auth\.getUser|assert[A-Za-z]*Access|CRON_SECRET|validate[A-Za-z]*Token|getAuthenticated[A-Za-z]*|resolve[A-Za-z]*(Auth|Actor|User|RouteContext)[A-Za-z]*\(/
const ANONYMOUS_WRITE_RE = /health-anonymous-write/
const SERVICE_ROLE_RE = /createAdminSupabase|SUPABASE_SERVICE_ROLE_KEY/

function localFunctionBlock(source, name) {
  const declaration = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source)
  if (!declaration) return ''
  const start = source.indexOf('{', declaration.index)
  if (start < 0) return ''

  let depth = 0
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(declaration.index, index + 1)
  }
  return ''
}

function expandLocalHandlers(source, methodSource) {
  const calledNames = [...methodSource.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((match) => match[1])
  return [...new Set(calledNames)].reduce(
    (expanded, name) => `${expanded}\n${localFunctionBlock(source, name)}`,
    methodSource,
  )
}

function analyzeMethodSecurity(source) {
  const matches = [...source.matchAll(new RegExp(METHOD_RE.source, 'g'))]
  return matches.map((match, index) => {
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? source.length
    const methodSource = expandLocalHandlers(source, source.slice(start, end))
    return {
      method: match[1],
      rateLimited: EFFECTIVE_RATE_LIMIT_RE.test(methodSource),
      turnstile: TURNSTILE_RE.test(methodSource),
      superAdminGuard: SUPERADMIN_GUARD_RE.test(methodSource),
      authGuard: AUTH_GUARD_RE.test(methodSource) && !ANONYMOUS_WRITE_RE.test(methodSource),
      serviceRole: SERVICE_ROLE_RE.test(methodSource),
    }
  })
}

const routeFiles = walk(path.join(APP, 'api'), (f) => /[\\/]route\.(ts|tsx|js)$/.test(f))
const apiRoutes = routeFiles
  .map((file) => {
    const source = read(file)
    const methodSecurity = analyzeMethodSecurity(source)
    const methods = [...new Set(methodSecurity.map((entry) => entry.method))]
    const mutatingMethods = methodSecurity.filter((entry) => entry.method !== 'GET')
    return {
      route: routeFromFile(file),
      methods,
      methodSecurity,
      rateLimited: mutatingMethods.length > 0 && mutatingMethods.every((entry) => entry.rateLimited),
      turnstile: TURNSTILE_RE.test(source),
      superAdminGuard: SUPERADMIN_GUARD_RE.test(source),
      authGuard: AUTH_GUARD_RE.test(source),
      serviceRole: SERVICE_ROLE_RE.test(source),
    }
  })
  .sort((a, b) => a.route.localeCompare(b.route))

// Client Components que leen variables no públicas: en el navegador valen
// undefined, y si alguna vez se "arreglan" con NEXT_PUBLIC_ se filtra el secreto.
const clientFiles = walk(SRC, (f) => /\.(ts|tsx)$/.test(f) && !/\.(test|spec|stories)\.(ts|tsx)$/.test(f))
// El propio diagnóstico nombra gtag, cookies, etc. en sus textos: no cuenta como integración.
const HEALTH_SELF = /[\\/]lib[\\/]health[\\/]|[\\/]system-health[\\/]/
const appFiles = clientFiles.filter((file) => !HEALTH_SELF.test(file))
const clientPrivateEnvRefs = []
for (const file of clientFiles) {
  const source = read(file)
  if (!/^\s*['"]use client['"]/m.test(source.slice(0, 300))) continue
  const refs = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)]
    .map((m) => m[1])
    .filter((name) => !name.startsWith('NEXT_PUBLIC_') && name !== 'NODE_ENV')
  if (refs.length > 0) clientPrivateEnvRefs.push({ file: rel(file), vars: [...new Set(refs)] })
}

const pageDirs = walk(APP, (f) => /[\\/]page\.(tsx|ts|jsx|js)$/.test(f)).map(routeFromFile)
const legalPages = pageDirs.filter((route) => /privacidad|privacy|terminos|t%C3%A9rminos|terms|legal|cookies/i.test(route))

const cookieConsentFiles = appFiles
  .filter((file) => !/[\\/](test|tests|stories)[\\/]/.test(file))
  .filter((file) => /cookie[-_ ]?(consent|banner|notice)/i.test(path.basename(file)) || /CookieConsent|CookieBanner|cookie-consent/.test(read(file)))
  .map(rel)

const errorBoundaries = walk(APP, (f) => /[\\/](error|global-error|not-found)\.(tsx|ts)$/.test(f)).map(rel)

const ga4Files = appFiles
  .filter((file) => /googletagmanager|gtag\(|@next\/third-parties\/google|GoogleAnalytics/.test(read(file)))
  .map(rel)

const PUBLIC_DIR = path.join(ROOT, 'public')
const SENSITIVE_PUBLIC_EXT = /\.(csv|xlsx|xls|sql|env|bak|dump|sqlite|db|log|pem|key)$/i
const publicSensitiveFiles = walk(PUBLIC_DIR, (f) => SENSITIVE_PUBLIC_EXT.test(f)).map((file) =>
  `/${path.relative(PUBLIC_DIR, file).split(path.sep).join('/')}`,
)

const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')
const migrationVersions = fs.existsSync(MIGRATIONS_DIR)
  ? fs
      .readdirSync(MIGRATIONS_DIR)
      .map((name) => name.match(/^(\d{14})_.*\.sql$/)?.[1])
      .filter(Boolean)
      .sort()
  : []

const paymentsDir = path.join(APP, 'api', 'payments')
const paymentProviders = fs.existsSync(paymentsDir)
  ? fs
      .readdirSync(paymentsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        provider: entry.name,
        webhookRoutes: apiRoutes
          .filter((r) => r.route.startsWith(`/api/payments/${entry.name}/`) && /webhook|notify|callback|ipn/.test(r.route))
          .map((r) => r.route),
      }))
  : []

const superAdminLayout = path.join(APP, 'superadmin', 'layout.tsx')
const superAdminLayoutGuarded = fs.existsSync(superAdminLayout) && SUPERADMIN_GUARD_RE.test(read(superAdminLayout))

const manifest = {
  generatedAt: new Date().toISOString(),
  apiRoutes,
  clientPrivateEnvRefs,
  legalPages,
  cookieConsentFiles,
  errorBoundaries,
  ga4Files,
  publicSensitiveFiles,
  migrationVersions,
  paymentProviders,
  superAdminLayoutGuarded,
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `[health-manifest] ${apiRoutes.length} rutas API, ${publicSensitiveFiles.length} archivos sensibles en public/, ` +
    `${clientPrivateEnvRefs.length} client components con env privadas -> ${rel(OUT)}`,
)
