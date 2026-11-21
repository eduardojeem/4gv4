import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useStorefrontCompanyInfo } from '@/components/public/storefront-style-context'
import type { CompanyInfo } from '@/types/website-settings'
import { readableBrandAction } from '@/lib/website/brand-palette'
function Probe() {
  const company = useStorefrontCompanyInfo({name:'Ejemplo',brandColor:'blue',brandPalette:{primary:'#FFFF00',accent:'#7E2A6E',background:'#FAFAFC',text:'#202633'}} as Partial<CompanyInfo>)
  return <output>{company.brandColor}:{company.customBrandColor}</output>
}
it('las plantillas detectan la combinación aunque el color anterior guardado sea otro', () => {
  render(<Probe />)
  expect(screen.getByRole('status')).toHaveTextContent('custom:'+readableBrandAction('#FFFF00'))
})
