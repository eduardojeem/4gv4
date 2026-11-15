import {render,screen,cleanup} from '@testing-library/react'
import {afterEach,it,expect} from 'vitest'
import {BarberLocation} from '@/components/public/barber/BarberLocation'
afterEach(cleanup)
it('uses the configured company address and a lazy embedded map',()=>{render(<BarberLocation company={{name:'Barbería de prueba',address:'Dirección de prueba, Paraguay'}}/>);expect(screen.getByTitle('Ubicación de Barbería de prueba')).toHaveAttribute('loading','lazy');expect(screen.getByRole('link',{name:'Cómo llegar'})).toHaveAttribute('href','https://www.google.com/maps/dir/?api=1&destination=Direcci%C3%B3n%20de%20prueba%2C%20Paraguay');});
it('does not invent a location when none is configured',()=>{const {container}=render(<BarberLocation company={{name:'Sin ubicación'}}/>);expect(container).toBeEmptyDOMElement();});
it('keeps a valid short Maps link usable when no embed is available',()=>{render(<BarberLocation company={{name:'Prueba',mapsUrl:'https://maps.app.goo.gl/example'}}/>);expect(screen.getByRole('link',{name:'Cómo llegar'})).toHaveAttribute('href','https://maps.app.goo.gl/example');expect(screen.queryByTitle('Ubicación de Prueba')).not.toBeInTheDocument();});