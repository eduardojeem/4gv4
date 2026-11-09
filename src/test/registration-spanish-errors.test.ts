import { describe, expect, it } from 'vitest'
import { describeAuthError } from '@/lib/auth/auth-error-messages'
import { registerCompanySchema } from '@/lib/validation/saas'
const weak='Password is known to be weak and easy to guess, please choose a different one.'
describe('Mensajes del registro en español',()=>{
 it('explica el rechazo por contraseña común, aunque cumpla longitud y caracteres',()=>{
  expect(describeAuthError(weak,'register')).toMatch(/contraseña.*(común|adivinar)/i)
  expect(describeAuthError(weak,'register')).not.toContain('Password')
 })
 it('los límites del formulario tampoco muestran validación inglesa',()=>{
  const result=registerCompanySchema.safeParse({fullName:'a'.repeat(121),email:'a'.repeat(250)+'@example.com',password:'Valid-Password-2026',companyName:'a'.repeat(121),companySlug:'a'.repeat(65),plan:'a'.repeat(49),businessVertical:'no-existe'})
  expect(result.success).toBe(false)
  if(!result.success){expect(result.error.issues.map(i=>i.message).join(' ')).not.toMatch(/Too big|Too small|Invalid|expected|received/i)}
 })
})
