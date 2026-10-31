import {render,screen,fireEvent} from '@testing-library/react'
import {describe,it,expect,vi,beforeEach} from 'vitest'
import type {PublicProduct} from '@/types/public'
import type {StorefrontStyle} from '@/lib/website/storefront-style'
const state=vi.hoisted(()=>({style:'classic' as StorefrontStyle,addProduct:vi.fn(()=>({limited:false}))}))
vi.mock('next/navigation',()=>({usePathname:()=>'/synthetic/inicio'}))
vi.mock('@/hooks/use-public-cart',()=>({usePublicCart:()=>({items:[],addProduct:state.addProduct,setQuantity:vi.fn()})}))
vi.mock('@/hooks/useWebsiteSettings',()=>({useWebsiteSettings:()=>({settings:{checkout:{commerceMode:'cart'},company_info:{}},isLoading:false})}))
vi.mock('@/components/public/storefront-style-context',()=>({useStorefrontStyle:()=>state.style}))
vi.mock('@/components/ui/app-image',()=>({AppImage:({src,alt,className}:{src:string;alt:string;className?:string})=> <span role="img" aria-label={alt} data-src={src} className={className}/>}))
import {ProductCard} from '@/components/public/ProductCard'
const product={id:'synthetic-product',name:'Producto sintético',sku:'DEV-001',sale_price:10000,wholesale_price:null,in_stock:true,stock_quantity:30,image:'/synthetic.jpg',images:[],unit_measure:'unidad'} as unknown as PublicProduct
beforeEach(()=>{state.addProduct.mockClear()})
describe('combined storefront keeps existing product media intact',()=>{
it.each(['classic','tech','beauty','market','modern','services','fashion','sport'] as const)('preserves default image spacing and hover for %s',style=>{state.style=style;render(<ProductCard product={product}/>);const img=screen.getByRole('img',{name:product.name});if(['modern','fashion','sport'].includes(style)){expect(img.className).toContain('object-cover');expect(img.className).toContain('group-hover:scale-[1.03]')}else{expect(img.className).toContain('p-4');expect(img.className).toContain('group-hover:scale-[1.06]')};const media=screen.getByRole('button',{name:'Vista rápida de '+product.name});expect(media.className).not.toContain('dark:bg-muted/10')})
it('limits compact media and SKU to Wholesale Pro',()=>{state.style='wholesale-pro';render(<ProductCard product={product}/>);expect(screen.getByRole('img',{name:product.name}).className).toContain('p-3');expect(screen.getByText('SKU: DEV-001')).toBeDefined();expect(screen.getByRole('button',{name:'Vista rápida de '+product.name}).className).toContain('dark:bg-muted/10')})
it('continues using shared checkout pricing for authorized wholesale',()=>{state.style='wholesale-pro';const authorized={...product,wholesale_price:8000};render(<ProductCard product={authorized}/>);fireEvent.click(screen.getByRole('button',{name:'Agregar '+product.name+' al carrito'}));expect(state.addProduct).toHaveBeenCalledWith(authorized,8000,1,null)})
})
