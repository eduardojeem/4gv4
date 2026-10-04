import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261003223526_move_global_category_safely.sql'),
  'utf8',
)

describe('movimiento seguro de categorías globales', () => {
  it('bloquea y recorre la rama antes de moverla', () => {
    expect(migration).toMatch(/move_global_category_safely/i)
    expect(migration).toMatch(/with recursive/i)
    expect(migration).toMatch(/for update/i)
    expect(migration).toMatch(/errcode = 'CAT01'/i)
    expect(migration).toMatch(/errcode = 'CAT02'/i)
    expect(migration).toMatch(/update public\.global_categories[\s\S]+level/i)
  })

  it('es una operación privilegiada con actor explícito', () => {
    expect(migration).toMatch(/p_actor_user_id uuid/i)
    expect(migration).toMatch(/security definer/i)
    expect(migration).toMatch(/set search_path = ''/i)
    expect(migration).toMatch(/revoke execute[\s\S]+from public, anon, authenticated/i)
    expect(migration).toMatch(/grant execute[\s\S]+to service_role/i)
  })
})
