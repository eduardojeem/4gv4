import { describe, expect, it } from 'vitest'
import { withAlias } from './manual-link'

describe('alias al vincular a mano', () => {
  it('agrega el nombre de la empresa como alias', () => {
    expect(withAlias('Celulares', ['Telefonía'], 'Smartphones')).toEqual(['Telefonía', 'Smartphones'])
  })

  it('no repite: ni el nombre de la global ni un alias que ya está (sin mayúsculas ni tildes)', () => {
    expect(withAlias('Celulares', [], 'celulares')).toBeNull()
    expect(withAlias('Audio y Video', ['Audífonos'], 'AUDIFONOS')).toBeNull()
    expect(withAlias('Celulares', [], '  ')).toBeNull()
    expect(withAlias('Celulares', [], null)).toBeNull()
  })
})
