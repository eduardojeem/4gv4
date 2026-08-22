import { describe, expect, it } from 'vitest'

import {
  buildCustomerRepairsHref,
  getCustomerRepairStatusFilter,
  parseCustomerRepairsQuery,
} from './customer-repairs'

describe('customer repairs query', () => {
  it('normalizes invalid filters and page values', () => {
    expect(parseCustomerRepairsQuery({ status: 'unknown', page: '-4' })).toEqual({
      status: 'all',
      page: 1,
    })
  })

  it('supports the available status groups', () => {
    expect(getCustomerRepairStatusFilter('active')).toEqual([
      'recibido',
      'diagnostico',
      'reparacion',
      'pausado',
    ])
    expect(getCustomerRepairStatusFilter('ready')).toEqual(['listo'])
    expect(getCustomerRepairStatusFilter('all')).toBeNull()
  })

  it('builds tenant-safe pagination links and omits default values', () => {
    expect(buildCustomerRepairsHref('/4g-celulares/mis-reparaciones', 'all', 1)).toBe(
      '/4g-celulares/mis-reparaciones'
    )
    expect(buildCustomerRepairsHref('/4g-celulares/mis-reparaciones', 'delivered', 3)).toBe(
      '/4g-celulares/mis-reparaciones?status=delivered&page=3'
    )
  })
})
