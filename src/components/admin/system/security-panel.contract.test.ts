import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const panelSource = readFileSync(
  resolve(process.cwd(), 'src/components/admin/system/security-panel.tsx'),
  'utf8'
)

const pageSource = readFileSync(
  resolve(process.cwd(), 'src/app/admin/security/page.tsx'),
  'utf8'
)

describe('Security Section UX for Non-Technical Users', () => {
  it('page.tsx has friendly executive title and guided explanations', () => {
    expect(pageSource).toContain('Centro de Seguridad & Control de Actividad')
    expect(pageSource).toContain('¿Para qué sirve este panel de seguridad?')
    expect(pageSource).toContain('¿Quién hizo qué?')
    expect(pageSource).toContain('¿Mi tienda está a salvo?')
    expect(pageSource).toContain('¿Quién puede entrar?')
  })

  it('security-panel.tsx provides human event details and friendly device detection', () => {
    expect(panelSource).toContain('getHumanEventDetails')
    expect(panelSource).toContain('parseUserAgent')
    expect(panelSource).toContain('Acceso Bloqueado / Contraseña Incorrecta')
    expect(panelSource).toContain('Inicio de Sesión Exitoso')
    expect(panelSource).toContain('Descarga de Información (Excel/CSV)')
  })

  it('security-panel.tsx features executive health banner and business-friendly metric cards', () => {
    expect(panelSource).toContain('Tu tienda está operando con total normalidad')
    expect(panelSource).toContain('Actividades Registradas')
    expect(panelSource).toContain('Alertas Críticas')
    expect(panelSource).toContain('Accesos Bloqueados')
    expect(panelSource).toContain('Cambios Importantes')
  })

  it('security-panel.tsx explains the 5 protection pillars in commercial terms', () => {
    expect(panelSource).toContain('Los 5 Escudos de Protección de tu Tienda')
    expect(panelSource).toContain('Aislamiento Total de Sucursales & Datos (RLS)')
    expect(panelSource).toContain('Conexión Cifrada de Grado Bancario (HTTPS / SSL)')
    expect(panelSource).toContain('Caja Negra / Historial Imborrable de Acciones')
  })

  it('security-panel.tsx includes interactive security checklist for business owners', () => {
    expect(panelSource).toContain('Autoevaluación de Seguridad para tu Negocio')
    expect(panelSource).toContain('Una cuenta para cada empleado')
    expect(panelSource).toContain('Por qué no compartir cuentas entre cajeros')
  })

  it('security-panel.tsx has specific data modification diff viewer with Before vs After (Antes vs Ahora)', () => {
    expect(panelSource).toContain('getDiffChanges')
    expect(panelSource).toContain('Detalle Específico de lo que Cambió')
    expect(panelSource).toContain('Valor Anterior (Antes)')
    expect(panelSource).toContain('Nuevo Valor (Ahora)')
  })

  it('security-panel.tsx explains role permissions and shows tenant-scoped user activity', () => {
    expect(panelSource).toContain('permissions:')
    expect(panelSource).toContain('Actividad en tu tienda:')
    expect(panelSource).toContain('Última interacción:')
    expect(panelSource).toContain('userRoleFilter')
    expect(panelSource).toContain('userStatusFilter')
  })

  it('security-panel.tsx protects customer data with explicit tenant isolation and badges', () => {
    expect(panelSource).toContain('Aislamiento y Confidencialidad Multi-Tenant')
    expect(panelSource).toContain('Exclusivo de tu tienda')
  })

  it('security-panel.tsx includes pagination for accounts and users list', () => {
    expect(panelSource).toContain('userPage')
    expect(panelSource).toContain('userPageSize')
    expect(panelSource).toContain('totalUserPages')
    expect(panelSource).toContain('paginatedUsers')
  })

  it('security-panel.tsx provides option to view full customer detail and navigate to CRM', () => {
    expect(panelSource).toContain('selectedCustomerModal')
    expect(panelSource).toContain('Ficha Cliente')
    expect(panelSource).toContain('MODAL DE FICHA Y PERFIL COMPLETO DEL CLIENTE')
    expect(panelSource).toContain('Ir a Gestión de Clientes')
    expect(panelSource).toContain('/dashboard/customers?search=')
  })
})
