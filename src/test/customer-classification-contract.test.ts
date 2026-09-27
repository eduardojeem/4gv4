import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('customer create and edit preserve identity and classification', () => {
  const modal = read('src/components/dashboard/customers/CustomerModal.tsx')
  const simpleForm = read('src/components/dashboard/customer-form-simple.tsx')
  const editForm = read('src/components/dashboard/customers/CustomerEditFormV2.tsx')

  it('uses the shared context actions so a new customer appears immediately', () => {
    expect(modal).toContain("import { useCustomers } from '@/contexts/CustomerContext'")
    expect(modal).toContain('const { updateCustomer, createCustomer } = useCustomers()')
    expect(modal).not.toContain('useCustomerActions()')
  })

  it('submits split names, synchronized business name, and canonical classification', () => {
    expect(modal).toContain('classificationForFormType(formData.customerType)')
    expect(modal).toContain('first_name: formData.firstName')
    expect(modal).toContain('last_name: formData.lastName')
    expect(modal).toContain('company_name: formData.companyName')
    expect(modal).toContain('customer_type: classification.customer_type')
  })

  it('asks for a business name only when it is relevant', () => {
    expect(simpleForm).toContain('companyName?: string')
    expect(simpleForm).toContain("formData.customerType === 'empresa' || formData.customerType === 'mayorista'")
    expect(simpleForm).toContain("handleInputChange('companyName'")
  })

  it('does not downgrade a wholesale customer while editing', () => {
    expect(editForm).toContain("z.enum(['regular', 'premium', 'empresa', 'wholesale'])")
    expect(editForm).toContain("const TYPE_OPTIONS = ['regular', 'premium', 'empresa', 'wholesale'] as const")
    expect(editForm).toContain('normalizeCustomerStatus(v)')
    expect(editForm).toContain('company_name')
  })
})
