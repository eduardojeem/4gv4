import { describe, expect, it } from 'vitest'

import {
  normalizePhone,
  normalizeText,
  parseCustomerQuery,
  rankCustomers,
  searchCustomers,
  type SearchableCustomer,
} from './search'

const PADRON: SearchableCustomer[] = [
  {
    id: '1',
    name: 'José Rodríguez',
    email: 'jose@ejemplo.com',
    phone: '0981 123-456',
    alternate_phone: '021 555 777',
    ruc: '80012345-6',
    customerCode: 'CLI-000001',
    city: 'Asunción',
    company: 'Rodríguez SA',
    address: 'Av. España 1234',
    notes: 'Cliente de San Lorenzo',
    customer_type: 'premium',
    status: 'active',
    segment: 'vip',
  },
  {
    id: '2',
    name: 'Silvia Romero',
    email: 'silvia@otro.com',
    phone: '+595 985 999 111',
    ruc: '1234567-8',
    customerCode: 'CLI-000002',
    city: 'San Lorenzo',
    customer_type: 'regular',
    status: 'active',
    segment: 'regular',
  },
  {
    id: '3',
    name: 'Ana Benítez',
    email: 'ana@correo.com',
    phone: '0972000333',
    customerCode: 'CLI-000003',
    city: 'Luque',
    customer_type: 'regular',
    status: 'inactive',
    segment: 'regular',
  },
]

const nombres = (rows: SearchableCustomer[]) => rows.map((row) => row.name)

describe('normalizacion', () => {
  it('ignora tildes y mayusculas', () => {
    expect(normalizeText('José RODRÍGUEZ')).toBe('jose rodriguez')
    expect(normalizeText('Asunción')).toBe('asuncion')
    expect(normalizeText(null)).toBe('')
  })

  it('un telefono es el mismo con o sin prefijo y con o sin formato', () => {
    // Los tres son el mismo numero escrito de tres formas.
    expect(normalizePhone('0981 123-456')).toBe('981123456')
    expect(normalizePhone('+595 981 123 456')).toBe('981123456')
    expect(normalizePhone('981123456')).toBe('981123456')
  })

  it('no le come el cero a un numero corto', () => {
    expect(normalizePhone('0')).toBe('0')
  })
})

/**
 * El «fuzzy» anterior era una subsecuencia: si las letras de la consulta
 * aparecian en orden, devolvia siempre 80. Con una letra coincidia casi todo el
 * padron, y todos con el mismo puntaje.
 */
describe('ya no coincide cualquier cosa', () => {
  it('una letra solo trae a quien empieza con ella', () => {
    // Antes «a» entraba como subsecuencia en los tres. Ahora una o dos letras
    // solo valen al principio de una palabra: escribir «j» y ver a los Juan es
    // lo esperable; ver a todos los que tienen una jota en el medio, no.
    expect(nombres(searchCustomers(PADRON, 'a'))).toEqual(['Ana Benítez'])
    // «ro» encuentra a Rodríguez y a Romero: las dos palabras empiezan asi.
    expect(nombres(searchCustomers(PADRON, 'ro')).sort()).toEqual(['José Rodríguez', 'Silvia Romero'])
    // Pero no a quien la tiene en el medio.
    expect(searchCustomers(PADRON, 'ez')).toHaveLength(0)
  })

  it('las letras sueltas en orden no son una coincidencia', () => {
    // «sr» estaba en «Silvia Romero» y en cualquiera con una s antes de una r.
    expect(searchCustomers(PADRON, 'sr')).toHaveLength(0)
    expect(searchCustomers(PADRON, 'jrz')).toHaveLength(0)
  })

  it('lo que si es una coincidencia sigue encontrandose', () => {
    expect(nombres(searchCustomers(PADRON, 'rodriguez'))).toContain('José Rodríguez')
    expect(nombres(searchCustomers(PADRON, 'romero'))).toContain('Silvia Romero')
  })
})

describe('acentos', () => {
  it('se encuentra a José escribiendo jose, y al reves', () => {
    expect(nombres(searchCustomers(PADRON, 'jose'))).toContain('José Rodríguez')
    expect(nombres(searchCustomers(PADRON, 'José'))).toContain('José Rodríguez')
    expect(nombres(searchCustomers(PADRON, 'benitez'))).toContain('Ana Benítez')
  })

  it('tambien en la ciudad', () => {
    expect(nombres(searchCustomers(PADRON, 'asuncion'))).toContain('José Rodríguez')
  })
})

describe('telefonos', () => {
  it('encuentra por una parte del numero aunque este guardado con formato', () => {
    // Antes: con menos de 8 digitos comparaba el texto crudo y «0981123» no
    // encontraba «0981 123-456».
    expect(nombres(searchCustomers(PADRON, '0981123'))).toContain('José Rodríguez')
    expect(nombres(searchCustomers(PADRON, '981 123'))).toContain('José Rodríguez')
  })

  it('el prefijo de pais no cambia el resultado', () => {
    expect(nombres(searchCustomers(PADRON, '+595985999111'))).toContain('Silvia Romero')
    expect(nombres(searchCustomers(PADRON, '0985999111'))).toContain('Silvia Romero')
  })

  it('encuentra por el telefono secundario', () => {
    // El campo existia en la ficha pero la busqueda no lo miraba.
    expect(nombres(searchCustomers(PADRON, '021555777'))).toContain('José Rodríguez')
  })

  it('dos digitos no alcanzan para traer medio padron', () => {
    expect(searchCustomers(PADRON, '09')).toHaveLength(0)
  })
})

describe('documentos y codigos', () => {
  it('el RUC se encuentra con o sin guion, sin pedir 12 digitos', () => {
    // Antes el match exacto exigia /^\d{12}$/, que casi ningun RUC cumple.
    expect(nombres(searchCustomers(PADRON, '80012345-6'))).toContain('José Rodríguez')
    expect(nombres(searchCustomers(PADRON, '800123456'))).toContain('José Rodríguez')
    expect(nombres(searchCustomers(PADRON, '8001234'))).toContain('José Rodríguez')
  })

  it('el codigo de cliente se busca entero o por el final', () => {
    expect(nombres(searchCustomers(PADRON, 'CLI-000002'))).toEqual(['Silvia Romero'])
    expect(nombres(searchCustomers(PADRON, 'cli-0000'))).toHaveLength(3)
  })
})

/**
 * El puntaje anterior era el PROMEDIO de los campos que coincidian: acertar en
 * mas campos bajaba el puntaje y hundia al mejor candidato.
 */
describe('coincidir en mas campos sube, no baja', () => {
  it('quien acierta nombre y correo va antes que quien solo acierta el nombre', () => {
    const padron: SearchableCustomer[] = [
      { id: 'a', name: 'Marcos Duarte', email: 'otra@cosa.com' },
      { id: 'b', name: 'Marcos Duarte', email: 'marcos@ejemplo.com' },
    ]
    const [primero] = rankCustomers(padron, 'marcos')
    expect(primero.customer.id).toBe('b')
    expect(primero.fields).toContain('email')
  })

  it('el nombre exacto gana al que solo lo contiene', () => {
    const padron: SearchableCustomer[] = [
      { id: 'a', name: 'Ana Maria Gonzalez' },
      { id: 'b', name: 'Ana' },
    ]
    expect(rankCustomers(padron, 'ana')[0].customer.id).toBe('b')
  })

  it('un nombre siempre gana a una nota', () => {
    const padron: SearchableCustomer[] = [
      { id: 'nota', name: 'Pedro Lopez', notes: 'Referido por Ramirez' },
      { id: 'nombre', name: 'Ramirez Servicios' },
    ]
    expect(rankCustomers(padron, 'ramirez')[0].customer.id).toBe('nombre')
  })

  it('dice por que campo aparece cada uno', () => {
    const [match] = rankCustomers(PADRON, '0981123')
    expect(match.fields).toContain('phone')
  })
})

describe('campos debiles', () => {
  it('la direccion y las notas piden una consulta especifica', () => {
    // Con dos o tres letras ensucian la lista sin aportar nada.
    expect(searchCustomers(PADRON, 'av')).toHaveLength(0)
    expect(nombres(searchCustomers(PADRON, 'espana'))).toContain('José Rodríguez')
  })

  it('la ciudad como texto encuentra a los dos que corresponden', () => {
    // «San Lorenzo» es la ciudad de Silvia y aparece en las notas de José.
    const resultados = nombres(searchCustomers(PADRON, 'san lorenzo'))
    expect(resultados).toContain('Silvia Romero')
    expect(resultados).toContain('José Rodríguez')
    // Pero la ciudad pesa mas que la nota.
    expect(resultados[0]).toBe('Silvia Romero')
  })
})

describe('filtros rapidos', () => {
  it('campo:valor sigue funcionando y ahora ignora tildes y mayusculas', () => {
    expect(nombres(searchCustomers(PADRON, 'customer_type:premium'))).toEqual(['José Rodríguez'])
    expect(nombres(searchCustomers(PADRON, 'city:ASUNCION'))).toEqual(['José Rodríguez'])
    expect(nombres(searchCustomers(PADRON, 'city:Asunción'))).toEqual(['José Rodríguez'])
    expect(nombres(searchCustomers(PADRON, 'status:inactive'))).toEqual(['Ana Benítez'])
  })

  it('un campo desconocido se busca como texto en vez de traer todo', () => {
    // Antes el `default: return true` del switch devolvia el padron entero.
    expect(searchCustomers(PADRON, 'cualquiera:cosa')).toHaveLength(0)
  })

  it('un correo con arroba no se confunde con un filtro', () => {
    expect(parseCustomerQuery('jose@ejemplo.com').kind).toBe('text')
    expect(nombres(searchCustomers(PADRON, 'jose@ejemplo.com'))).toEqual(['José Rodríguez'])
  })
})

describe('sin consulta', () => {
  it('devuelve el padron tal cual, sin reordenar', () => {
    expect(nombres(searchCustomers(PADRON, ''))).toEqual(nombres(PADRON))
    expect(nombres(searchCustomers(PADRON, '   '))).toEqual(nombres(PADRON))
  })
})

describe('el orden no baila entre renders', () => {
  it('dos clientes con el mismo puntaje se ordenan por nombre', () => {
    const padron: SearchableCustomer[] = [
      { id: 'z', name: 'Zulma Ruiz Diaz' },
      { id: 'a', name: 'Ariel Ruiz Diaz' },
    ]
    expect(searchCustomers(padron, 'ruiz').map((c) => c.id)).toEqual(['a', 'z'])
  })
})
