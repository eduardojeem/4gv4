import {render,screen} from '@testing-library/react'
import {describe,it,expect,vi} from 'vitest'
import type {WebsiteSettings} from '@/types/website-settings'
vi.mock('next/navigation',()=>({usePathname:()=>'/synthetic/inicio'}))
vi.mock('@/hooks/usePublicCategories',()=>({usePublicCategories:()=>({categories:[{id:'c1',name:'Herramientas',subcategories:[{id:'c2',name:'Manuales'}]}]})}))
vi.mock('@/components/public/cart/PublicCartButton',()=>({PublicCartButton:()=> <button>Carrito compartido</button>}))
import {WholesaleHeader} from '@/components/public/wholesale/WholesaleHeader'
describe('WholesaleHeader',()=>{
it('uses tenant catalog search without claiming model search',()=>{render(<WholesaleHeader settings={null}/>);expect(screen.getByRole('search').getAttribute('action')).toBe('/synthetic/productos');expect(screen.getByRole('searchbox').getAttribute('name')).toBe('query');expect(screen.getByRole('searchbox').getAttribute('placeholder')).not.toMatch(/modelo/);expect(screen.getByText('Carrito compartido')).toBeDefined()})
it('links real hierarchy and preserves settings',()=>{const settings=Object.freeze({company_info:{name:'Synthetic'},offers_section:{enabled:false}}) as unknown as WebsiteSettings;render(<WholesaleHeader settings={settings}/>);expect(screen.getByRole('link',{name:'Manuales'}).getAttribute('href')).toBe('/synthetic/productos?category_id=c2');expect(screen.queryByRole('link',{name:'Ofertas'})).toBeNull();expect(settings.company_info.name).toBe('Synthetic')})
})