import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
vi.mock('next/image',()=>({default:({fill,unoptimized,priority,alt='',...props}:React.ImgHTMLAttributes<HTMLImageElement>&{fill?:boolean;unoptimized?:boolean;priority?:boolean})=>{
 void fill;void unoptimized;void priority;
 // eslint-disable-next-line @next/next/no-img-element -- Native image mock is required for load/error events.
 return <img alt={alt} {...props}/>
}}))
import {PromotionalImage} from '@/components/public/PromotionalImage'
afterEach(cleanup)
it('shows a helpful failure state and retries instead of a broken image',()=>{render(<PromotionalImage src="/custom.webp" alt="Banner"/>);fireEvent.error(screen.getByAltText('Banner'));expect(screen.getByText('No se pudo cargar la imagen')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Reintentar imagen'}));expect(screen.getByAltText('Banner')).toBeInTheDocument()})
it('loads another source even after the previous image failed',()=>{const {rerender}=render(<PromotionalImage src="/first.webp" alt="Banner"/>);fireEvent.error(screen.getByAltText('Banner'));rerender(<PromotionalImage src="/second.webp" alt="Banner"/>);expect(screen.getByAltText('Banner')).toHaveAttribute('src','/second.webp')})
it('resolves saved legacy template paths to the bundled optimized file',()=>{render(<PromotionalImage src="/images/promotional-carousel/hero-barberia-turnos.jpg" alt="Banner"/>);expect(screen.getByAltText('Banner')).toHaveAttribute('src','/images/promotional-carousel/hero-barberia-turnos.webp')})