import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const VISTA = leer('src/components/dashboard/customers/CustomerListView.tsx')
const PANEL = leer('src/components/dashboard/customers/CustomerDashboard.tsx')

/**
 * En /dashboard/customers habia dos campos de busqueda, uno arriba del otro.
 *
 * El de abajo vivia dentro de la lista y filtraba su prop `customers`, que es
 * SOLO la pagina visible: parecia un buscador de clientes pero no podia
 * encontrar a nadie que no estuviera ya en pantalla. Y usaba sus propias reglas
 * —`includes` crudo sobre nombre, correo y telefono— distintas a las del
 * buscador de arriba: sin tildes, sin normalizar telefonos, sin RUC ni codigo.
 */
describe('los dos buscadores son el mismo', () => {
  it('el panel le pasa el termino y el manejador', () => {
    expect(PANEL).toContain('searchTerm={filters.search}')
    expect(PANEL).toContain("onSearchChange={(term) => updateFilters({ search: term })}")
  })

  it('la lista acepta que se lo manejen desde afuera', () => {
    expect(VISTA).toContain('searchTerm?: string')
    expect(VISTA).toContain('onSearchChange?: (term: string) => void')
    expect(VISTA).toContain(
      "const isControlled = typeof controlledSearchTerm === 'string' && typeof onSearchChange === 'function'"
    )
  })

  it('cuando se lo manejan, no vuelve a filtrar por su cuenta', () => {
    // El panel ya busco sobre todo el padron y ordeno por relevancia: filtrar de
    // nuevo aca solo podria sacar gente que si correspondia.
    expect(VISTA).toContain(
      'const filtered = isControlled || !searchTerm ? [...customers] : searchCustomers(customers, searchTerm)'
    )
  })

  it('suelto, al menos usa las reglas buenas y no un includes crudo', () => {
    expect(VISTA).toContain("import { searchCustomers } from '@/lib/customers/search'")
    expect(VISTA).not.toContain('customer.name.toLowerCase().includes(search)')
    expect(VISTA).not.toContain('customer.phone.includes(search)')
  })

  it('el campo dice por que se puede buscar', () => {
    // Decia «Buscar clientes...» y solo miraba tres campos.
    expect(VISTA).toContain('placeholder="Nombre, teléfono, CI/RUC, correo o código..."')
  })
})

/**
 * El comparador pasaba todo por `String(...)` salvo dos casos, asi que las
 * compras se ordenaban como texto —«100» antes que «20»— y nunca devolvia 0,
 * asi que dos iguales se intercambiaban en cada render.
 */
describe('el ordenamiento de la tabla', () => {
  it('los numeros se comparan como numeros', () => {
    expect(VISTA).toContain("const NUMERIC_SORT_FIELDS = new Set<SortField>(['lifetime_value', 'total_purchases'])")
    expect(VISTA).toContain('return (left - right) * direction || compareByName(a, b)')
  })

  it('ya no ordena numeros como texto', () => {
    expect(VISTA).not.toContain("aValue = String(aValue || '').toLowerCase()")
    expect(VISTA).not.toContain('return aValue > bValue ? 1 : -1')
  })

  it('el texto ignora tildes al ordenar', () => {
    // En una lista de nombres «Ángel» tiene que caer junto a «Angela».
    expect(VISTA).toContain("localeCompare(right, 'es', { sensitivity: 'base' })")
  })

  it('hay un desempate estable', () => {
    expect(VISTA).toContain('/** Desempate estable: sin esto, dos iguales bailan de lugar entre renders. */')
    expect(VISTA).toContain('function compareByName(a: Customer, b: Customer): number')
  })
})
