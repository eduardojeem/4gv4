import { describe, expect, it } from 'vitest'
import { mobileLoginAccess } from '@/lib/mobile/login-access'
import { customerIssues, customerPayload, captchaEnvironmentError } from '../../mobile/src/lib/customer-registration-model'
import { passwordChecks, registerIssues, emptyRegisterForm, registrationNotice } from '../../mobile/src/lib/registration-model'

describe('mobile customer and staff boundary', () => {
  it('admits active customer accounts without granting a staff membership', () => {
    expect(mobileLoginAccess({ status: 'active', role: 'cliente' }, { is_active: true, role: 'cliente' }, 0)).toBe('customer')
  })
  it('keeps inactive accounts blocked, even if they have a staff membership', () => {
    expect(mobileLoginAccess({ status: 'suspended', role: 'cliente' }, { is_active: true, role: 'cliente' }, 1)).toBe('inactive')
    expect(mobileLoginAccess({ status: 'active', role: 'cliente' }, { is_active: false, role: 'cliente' }, 0)).toBe('inactive')
  })
  it('denies missing identities and former staff with no active membership', () => {
    expect(mobileLoginAccess(null, null, 0)).toBe('not_staff')
    expect(mobileLoginAccess({ status: 'active', role: 'admin' }, { is_active: true, role: 'admin' }, 0)).toBe('not_staff')
  })
  it('preserves existing staff access and rejects inconsistent customer roles', () => {
    expect(mobileLoginAccess({ status: 'active', role: 'admin' }, { is_active: true, role: 'admin' }, 1)).toBe('ok')
    expect(mobileLoginAccess({ status: 'active', role: 'cliente' }, { is_active: true, role: 'admin' }, 0)).toBe('not_staff')
  })
})

describe('registration forms', () => {
  const form = { fullName: 'Ana Pérez', email: 'ana@example.com', password: 'BuenaClave123', confirmPassword: 'BuenaClave123' }
  it('a buyer needs no business or subscription plan', () => {
    expect(customerIssues(form)).toEqual({})
    expect(customerPayload(form, 'captcha-token')).toEqual({ fullName: 'Ana Pérez', email: 'ana@example.com', password: 'BuenaClave123', captchaToken: 'captcha-token' })
  })
  it('does not submit a mismatched password', () => {
    expect(customerIssues({ ...form, confirmPassword: 'otra' }).confirmPassword).toBeTruthy()
  })
  it('uses the platform minimum in the company form and checklist', () => {
    expect(passwordChecks('Clave123', 12)[0].ok).toBe(false)
    expect(registerIssues({ ...emptyRegisterForm('pro'), ...form, password: 'Clave123', confirmPassword: 'Clave123', companyName: 'Tienda' }, 12).password).toBeTruthy()
  })
  it('explains Expo Go production incompatibility without weakening return URLs', () => {
    expect(captchaEnvironmentError('exp://192.168.0.2:8081/--/captcha', 'https://mitiendapy.com')).toMatch(/Expo Go/)
    expect(captchaEnvironmentError('exp://192.168.0.2:8081/--/captcha', 'http://192.168.0.2:3000')).toBeNull()
    expect(captchaEnvironmentError('mitiendapy://captcha', 'https://mitiendapy.com')).toBeNull()
  })
})
describe('customer registration return', () => {
  it('explains confirmation for a personal account instead of claiming a commerce was created', () => {
    const notice = registrationNotice({ registered: true, confirmEmail: true }, 'customer')
    expect(notice).toContain('cuenta personal')
    expect(notice).toContain('Confirmá tu email')
    expect(notice).not.toContain('comercio')
  })
})