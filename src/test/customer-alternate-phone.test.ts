import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * El telefono del cliente suele ser el equipo que dejo en el taller: llamarlo a
 * ese numero no sirve justo cuando hay algo que avisarle. Por eso se guarda un
 * segundo contacto.
 *
 * El campo existia en el formulario de la seccion de clientes —se mostraba y se
 * validaba— pero el modal que guarda no lo mandaba, ni al crear ni al editar.
 * Se escribia y se perdia sin ningun aviso.
 */
describe('la seccion de clientes guarda el contacto alternativo', () => {
  const modal = leer('src/components/dashboard/customers/CustomerModal.tsx')
  const formulario = leer('src/components/dashboard/customer-form-simple.tsx')

  it('el formulario sigue pidiendolo', () => {
    expect(formulario).toContain("handleInputChange('alternatePhone'")
    expect(formulario).toContain("handleInputChange('alternatePhoneLabel'")
    expect(formulario).toContain('Otro teléfono para avisarle')
  })

  it('lo manda al crear y al editar', () => {
    // Se arma una vez y se reparte: si estuviera escrito dos veces, arreglar una
    // rama y olvidar la otra es exactamente como quedo la primera vez.
    expect(modal).toContain('const alternateContact = {')
    expect(modal).toContain('alternate_phone: alternatePhone,')

    const usos = [...modal.matchAll(/\.\.\.alternateContact,/g)]
    expect(usos, 'tiene que ir en el alta y en la edicion').toHaveLength(2)
  })

  it('no guarda la aclaracion sin telefono', () => {
    // "de su hermana" sin numero no sirve para nada y ensucia el detalle.
    expect(modal).toContain(
      "alternate_phone_label: alternatePhone ? (formData.alternatePhoneLabel?.trim() || null) : null,"
    )
  })

  it('lo carga al abrir la edicion', () => {
    // Sin esto el campo salia vacio y parecia que el cliente no tenia contacto
    // alternativo, aunque lo hubiera cargado desde reparaciones.
    expect(modal).toContain("alternatePhone: customer.alternate_phone || ''")
    expect(modal).toContain("alternatePhoneLabel: customer.alternate_phone_label || ''")
  })
})

/**
 * Guardarlo y no mostrarlo es casi lo mismo que no guardarlo: quien atiende el
 * mostrador no tiene de donde sacarlo cuando necesita llamar.
 */
describe('el detalle del cliente lo muestra', () => {
  for (const [nombre, ruta] of [
    ['detalle completo', 'src/components/dashboard/customers/CustomerDetail.tsx'],
    ['vista rapida', 'src/components/dashboard/customers/CustomerQuickView.tsx'],
    ['modal de cliente', 'src/components/dashboard/customers/CustomerModal.tsx'],
  ] as const) {
    it(`lo muestra en ${nombre}`, () => {
      // Cada pantalla nombra distinto al cliente que tiene a mano
      // (`customer`, `currentCustomer`), asi que se busca el campo.
      const archivo = leer(ruta)
      expect(archivo).toMatch(/\w+\.alternate_phone\b/)
      expect(archivo).toMatch(/\w+\.alternate_phone_label\b/)
    })
  }

  it('el detalle completo deja llamar y escribir a ese numero', () => {
    // Es el punto del campo: que se pueda usar sin copiarlo a mano.
    const detalle = leer('src/components/dashboard/customers/CustomerDetail.tsx')
    const bloque = detalle.slice(detalle.indexOf('Otro teléfono para avisarle'))
    expect(bloque.slice(0, 1800)).toContain('tel:${encodeURIComponent(currentCustomer.alternate_phone')
    expect(bloque.slice(0, 1800)).toContain('wa.me/${(currentCustomer.alternate_phone')
  })

  it('dice de quien es el numero, o avisa que no se aclaro', () => {
    // Un numero suelto no le sirve a quien llama: no sabe con quien va a hablar.
    const detalle = leer('src/components/dashboard/customers/CustomerDetail.tsx')
    expect(detalle).toContain('sin aclarar de quién es')
  })
})
