import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {ProductWhatsAppButton} from '@/components/public/ProductWhatsAppButton'
import {MarketplaceProductCarousel} from '@/components/public/MarketplaceProductCarousel'
import type {MarketplaceProduct} from '@/lib/public/marketplace'
vi.mock('next/navigation',()=>({usePathname:()=>'/marketplace'}))
vi.mock('@/contexts/auth-context',()=>({useAuth:()=>({user:null})}))
vi.mock('next/image',()=>({default:()=>null}))
afterEach(cleanup)
const product={id:'p1',name:'Producto consultable',sale_price:100000,in_stock:true,stock_quantity:2,image:null,images:[],organization_id:'o1',organization_name:'Empresa Uno',organization_slug:'uno',organization_contact:{whatsapp:'0981123456',phone:null,instagram:null,facebook:null,tiktok:null}} as unknown as MarketplaceProduct
it('shows a direct consultation alongside the product detail for a product with price',()=>{render(<MarketplaceProductCarousel title="Productos" products={[product]} autoPlay={false}/>);expect(screen.getByRole('link',{name:'Consultar por WhatsApp sobre Producto consultable'})).toHaveAttribute('href',expect.stringContaining('https://wa.me/595981123456?text='));expect(screen.getByRole('button',{name:'Detalle'})).toBeInTheDocument()})
it('honors disabled product inquiries in the real carousel',()=>{render(<MarketplaceProductCarousel title="Productos" products={[{...product,organization_contact:{...product.organization_contact!,productWhatsappEnabled:false}}]} autoPlay={false}/>);expect(screen.queryByRole('link',{name:/Consultar por WhatsApp/})).toBeNull();expect(screen.getByRole('button',{name:'Detalle'})).toBeInTheDocument()})
it('does not open a surrounding product card when clicking or using the keyboard',()=>{const open=vi.fn();render(<div onClick={open} onKeyDown={open}><ProductWhatsAppButton href="https://wa.me/595981123456?text=Hola" productName="Producto"/></div>);const link=screen.getByRole('link');fireEvent.click(link);fireEvent.keyDown(link,{key:'Enter'});expect(open).not.toHaveBeenCalled();expect(link).toHaveAttribute('rel','noopener noreferrer')})
it('does not render a dead contact button',()=>{render(<ProductWhatsAppButton href={null} productName="Producto"/>);expect(screen.queryByRole('link')).toBeNull()})