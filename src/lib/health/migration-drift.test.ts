import { describe, expect, it } from 'vitest'
import { evaluateMigrationHealth } from '@/lib/health/migration-drift'

describe('evaluateMigrationHealth', () => {
  const local = ['20260927160000', '20260929223000', '20261006120000']

  it('aprueba cuando el historial remoto contiene todas las migraciones locales', () => {
    expect(evaluateMigrationHealth(local, local)).toMatchObject({
      status: 'healthy',
      missingRemote: [],
      remoteOnly: [],
    })
  })

  it('advierte cuando hay migraciones locales sin registrar remotamente', () => {
    expect(evaluateMigrationHealth(local, local.slice(0, 2))).toMatchObject({
      status: 'warning',
      missingRemote: ['20261006120000'],
      remoteOnly: [],
    })
  })

  it('advierte cuando el historial remoto contiene versiones ausentes del checkout', () => {
    expect(evaluateMigrationHealth(local, [...local, '20261007120000'])).toMatchObject({
      status: 'warning',
      missingRemote: [],
      remoteOnly: ['20261007120000'],
    })
  })
})
