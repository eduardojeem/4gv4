import { describe, expect, it } from 'vitest'
import { storeEmailLogoUrl } from './store-logo'

describe('logo de la tienda en sus emails', () => {
  it('usa una dirección https tal cual', () => {
    expect(storeEmailLogoUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png')
  })

  it('completa una ruta propia con la dirección del sitio', () => {
    expect(storeEmailLogoUrl('/uploads/logo.png')).toMatch(/^https?:\/\/.+\/uploads\/logo\.png$/)
  })

  it('descarta lo que el correo no puede mostrar', () => {
    expect(storeEmailLogoUrl(null)).toBeUndefined()
    expect(storeEmailLogoUrl('  ')).toBeUndefined()
    expect(storeEmailLogoUrl('https://cdn.example.com/logo.svg')).toBeUndefined()
    expect(storeEmailLogoUrl('data:image/png;base64,AAAA')).toBeUndefined()
  })
})
