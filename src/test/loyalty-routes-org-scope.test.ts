/**
 * Todas las rutas de puntos y sorteos tienen que hablarle a Supabase diciendo
 * en qué organización están.
 *
 * Las políticas de RLS comparan contra `public.current_organization_id()`, que
 * resuelve sola únicamente si el usuario pertenece a UNA organización. Con el
 * cliente pelado (`createClient()`), un administrador que pertenece a varias
 * recibía 403 en todo, sin forma de entender por qué. En esta base eso afectaba
 * a 6 de 17 usuarios.
 *
 * Es un fallo silencioso y fácil de reintroducir al agregar una ruta nueva:
 * el código compila, los tipos pasan, y solo falla para los usuarios
 * multi-organización. Por eso se fija acá y no en una revisión de código.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOTS = ['src/app/api/loyalty', 'src/app/api/raffles']

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...routeFiles(full))
    else if (entry === 'route.ts') out.push(full)
  }
  return out
}

const files = ROOTS.flatMap(routeFiles)

describe('rutas de puntos y sorteos', () => {
  it('encuentra las rutas (si no, el test no estaría probando nada)', () => {
    expect(files.length).toBeGreaterThanOrEqual(8)
  })

  it.each(files)('%s usa el cliente con la organización, no el pelado', (file) => {
    const source = readFileSync(file, 'utf-8')

    expect(source).not.toContain("from '@/lib/supabase/server'")
    expect(source).toContain('createOrgScopedClient')
  })

  it.each(files)('%s toma la organización del contexto validado, no del pedido', (file) => {
    const source = readFileSync(file, 'utf-8')

    // El id tiene que venir de withTenantAuth, que ya comprobó la membresía.
    // Tomarlo del body o de la query sería confiar en el navegador.
    for (const call of source.match(/createOrgScopedClient\([^)]*\)/g) ?? []) {
      expect(call).toBe('createOrgScopedClient(organization.id)')
    }
  })
})
