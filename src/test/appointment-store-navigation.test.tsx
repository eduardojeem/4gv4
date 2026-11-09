import {cleanup,render,screen} from '@testing-library/react'
import {afterEach,describe,expect,it} from 'vitest'
import {AppointmentStoreNavigation} from '@/components/public/agenda/AppointmentStoreNavigation'
afterEach(cleanup)
describe('appointment return navigation',()=>{
 it('returns directly to the appointment store without depending on browser history',()=>{
  render(<AppointmentStoreNavigation slug="juanbarber" name="JuanBarber"/> )
  expect(screen.getByRole('link',{name:'Volver a la página de JuanBarber'})).toHaveAttribute('href','/juanbarber/inicio')
 })
 it('does not send customers to an unrelated store when the slug is missing',()=>{
  render(<AppointmentStoreNavigation slug={null} name="Tienda"/> )
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
 })
})
