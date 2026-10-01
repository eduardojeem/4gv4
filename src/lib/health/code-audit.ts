import manifest from '@/lib/health/generated/code-audit.json'

/** Ver scripts/generate-health-manifest.mjs (se regenera en `prebuild`). */
export interface CodeAuditMethodSecurity {
  method: string
  rateLimited: boolean
  turnstile: boolean
  superAdminGuard: boolean
  authGuard: boolean
  serviceRole: boolean
}

export interface CodeAuditRoute {
  route: string
  methods: string[]
  methodSecurity?: CodeAuditMethodSecurity[]
  rateLimited: boolean
  turnstile: boolean
  superAdminGuard: boolean
  authGuard: boolean
  serviceRole: boolean
}

export interface CodeAudit {
  generatedAt: string
  apiRoutes: CodeAuditRoute[]
  clientPrivateEnvRefs: Array<{ file: string; vars: string[] }>
  legalPages: string[]
  cookieConsentFiles: string[]
  errorBoundaries: string[]
  ga4Files: string[]
  publicSensitiveFiles: string[]
  migrationVersions: string[]
  paymentProviders: Array<{ provider: string; webhookRoutes: string[] }>
  superAdminLayoutGuarded: boolean
}

export const codeAudit: CodeAudit = manifest

export function codeAuditMethod(): string {
  return `Análisis estático del código generado en el build (${codeAudit.generatedAt}).`
}

export function isMutating(route: CodeAuditRoute): boolean {
  return route.methods.some((method) => method !== 'GET')
}

export function mutatingOperations(route: CodeAuditRoute): Array<CodeAuditMethodSecurity & { route: string }> {
  if (route.methodSecurity?.length) {
    return route.methodSecurity
      .filter((entry) => entry.method !== 'GET')
      .map((entry) => ({ ...entry, route: route.route }))
  }

  return route.methods
    .filter((method) => method !== 'GET')
    .map((method) => ({
      route: route.route,
      method,
      rateLimited: route.rateLimited,
      turnstile: route.turnstile,
      superAdminGuard: route.superAdminGuard,
      authGuard: route.authGuard,
      serviceRole: route.serviceRole,
    }))
}
