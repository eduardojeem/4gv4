import { renderToString } from 'react-dom/server'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MarketplaceBusinessPromo } from '@/components/public/MarketplaceBusinessPromo'
afterEach(cleanup)
describe('marketplace business invitation',()=>{
 it('does not offer inactive controls before hydration',()=>{
  const html=renderToString(<MarketplaceBusinessPromo/>);
  const doc=new DOMParser().parseFromString(html,'text/html');
  expect([...doc.querySelectorAll('[role="tab"]')].every(tab=>tab.hasAttribute('disabled'))).toBe(true);
 })
 it('lets visitors explore relevant benefits without navigating away',()=>{
  render(<MarketplaceBusinessPromo/>);
  expect(screen.getByRole('tab',{name:'Comercios'})).toHaveAttribute('aria-selected','true');
  fireEvent.click(screen.getByRole('tab',{name:'Talleres'}));
  expect(screen.getByRole('tab',{name:'Talleres'})).toHaveAttribute('aria-selected','true');
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Órdenes de reparación');
  fireEvent.click(screen.getByRole('tab',{name:'Servicios'}));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Agenda y reservas');
 })
 it('supports keyboard tabs and links directly to real plans and functions',()=>{
  render(<MarketplaceBusinessPromo/>);
  fireEvent.keyDown(screen.getByRole('tab',{name:'Comercios'}),{key:'End'});
  expect(screen.getByRole('tab',{name:'Servicios'})).toHaveAttribute('aria-selected','true');
  expect(screen.getByRole('link',{name:/Ver planes/})).toHaveAttribute('href','/saas#planes');
  expect(screen.getByRole('link',{name:/Ver funciones/})).toHaveAttribute('href','/saas#caracteristicas');
  expect(screen.queryByText(/gratis 7 días/i)).not.toBeInTheDocument();
 })
})
