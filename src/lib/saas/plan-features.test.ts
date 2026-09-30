import { describe, expect, it } from 'vitest'
import { repairPhotoLimitFromLimits } from './plan-features'

// Las fotos estaban fijas en código a ENTERPRISE, un plan inactivo: nadie
// podía tenerlas. Ahora el cupo lo define cada plan en `plans.limits`.
describe('fotos por reparación según el catálogo', () => {
  it('usa el cupo configurado en el plan', () => {
    expect(repairPhotoLimitFromLimits('BASIC', { repairPhotos: 3 })).toBe(3)
    expect(repairPhotoLimitFromLimits('PRO', { repairPhotos: '6' })).toBe(6)
    expect(repairPhotoLimitFromLimits('ENTERPRISE', { repairPhotos: 0 })).toBe(0)
  })

  it('sin dato en el catálogo conserva la regla anterior', () => {
    expect(repairPhotoLimitFromLimits('FREE', {})).toBe(0)
    expect(repairPhotoLimitFromLimits('BASIC', null)).toBe(0)
    expect(repairPhotoLimitFromLimits('ENTERPRISE', { repairPhotos: 'ilimitado' })).toBe(6)
  })
})
