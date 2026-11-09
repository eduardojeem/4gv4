import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrganizationDetailHeader, OrganizationOverviewNavigation } from '@/components/superadmin/organizations/organization-detail-header'
vi.mock('@/components/superadmin/EnterSupportButton',()=>({EnterSupportButton:({organizationId}:{organizationId:string})=><button data-organization={organizationId}>Modo soporte</button>}))
const props={id:'demo-id',name:'Mi tienda demo',slug:'mitiendademo',planName:'Pro',statusLabel:'En prueba',statusClass:'',verticalLabel:'Comercio',verticalIcon:'🏬',ownerLabel:'Propietario Demo',currency:'PYG',cancelScheduled:false,onEdit:vi.fn(),onRefresh:vi.fn(),onCopy:vi.fn()}
describe('cabecera del detalle de organización',()=>{
 it('identifica la empresa y conserva destinos específicos de tienda y facturación',()=>{
  render(<OrganizationDetailHeader {...props}/>);
  expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Mi tienda demo');
  expect(screen.getByRole('link',{name:/Abrir tienda/})).toHaveAttribute('href','/mitiendademo/inicio');
  expect(screen.getByRole('link',{name:/Facturación/})).toHaveAttribute('href','/superadmin/subscriptions?q=mitiendademo');
  expect(screen.getByRole('button',{name:'Modo soporte'})).toHaveAttribute('data-organization','demo-id');
 });
 it('ejecuta las acciones explícitas sin cambiar de empresa',()=>{
  render(<OrganizationDetailHeader {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'Editar empresa'}));expect(props.onEdit).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Copiar ID de la organización'}));expect(props.onCopy).toHaveBeenCalledWith('demo-id','ID de organización');
 });
 it('permite ir directamente a actividad, contacto y cuenta',()=>{
  render(<OrganizationOverviewNavigation/>);
  expect(screen.getByRole('link',{name:/Actividad del negocio/})).toHaveAttribute('href','#org-activity');
  expect(screen.getByRole('link',{name:/Datos de contacto/})).toHaveAttribute('href','#org-contact');
  expect(screen.getByRole('link',{name:/Datos de la cuenta/})).toHaveAttribute('href','#org-account');
 });
});
