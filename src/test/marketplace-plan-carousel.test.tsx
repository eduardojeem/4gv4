import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketplacePlanCarousel } from '../components/public/MarketplacePlanCarousel';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const plan = { id: '1', tier: 'PRO', public_slug: 'taller-pro', name: 'Taller Pro', price: 150000, price_note: 'Mensual', description: 'Para tu taller', trial_days: 14, is_popular: true, limits: [{key:'repairs',label:'Reparaciones por mes',value:'150'}], features: [{key:'warranty',label:'Garantías'}] };
describe('marketplace plan carousel', () => {
 it('shows published terms and registers with the selected plan', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>({plans:[plan]})}));
  render(<MarketplacePlanCarousel/>);
  expect(await screen.findByRole('link',{name:'Registrar mi empresa con Taller Pro'})).toHaveAttribute('href','/register?plan=taller-pro');
  expect(screen.getByText('14 días de prueba')).toBeInTheDocument();
  expect(screen.getByText('150')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:/Ya tengo una empresa/})).toHaveAttribute('href','/login');
 });
 it('offers retry after a failed request without fabricated plans', async () => {
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValueOnce({ok:true,json:async()=>({plans:[]})});
  vi.stubGlobal('fetch',fetcher);render(<MarketplacePlanCarousel/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos');
  fireEvent.click(screen.getByRole('button',{name:'Volver a intentar'}));
  expect(await screen.findByText('No hay planes publicados en este momento.')).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(2);
 });
});
