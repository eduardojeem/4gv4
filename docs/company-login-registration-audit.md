# Auditoria de login y registro para empresas publicadoras

## Rutas auditadas

- `/login`
- `/register`
- `/api/auth/register-company`
- `/api/organizations`
- `src/lib/saas/permissions.ts`

## Estado actual

### Login

La ruta `/login` permite iniciar sesion con email y password usando Supabase Auth.

Despues del login:

- redirige al path enviado por `redirect`, o al valor seguro por defecto;
- no pregunta tipo de usuario;
- no diferencia visualmente entre empresa, empleado, cliente o superadmin;
- el rol se resuelve despues, desde tablas internas y permisos.

### Registro publico

La ruta `/register` esta pensada para registrar una empresa nueva.

Campos actuales:

- nombre completo
- correo electronico
- nombre de empresa
- slug/subdominio
- contrasena
- confirmacion de contrasena

Endpoint usado:

- `/api/auth/register-company`

Lo que crea:

- usuario en Supabase Auth;
- organizacion en `organizations`;
- membresia en `organization_members` con `role = owner`;
- settings iniciales en `organization_settings`;
- suscripcion FREE en `subscriptions`;
- perfil legacy en `profiles` con `role = admin`;
- rol legacy en `user_roles` con `role = admin`;
- sucursal principal en `branches`.

## Roles disponibles en arquitectura SaaS

Fuente moderna:

- `organization_members.role`

Roles soportados:

- `owner`
- `admin`
- `manager`
- `cashier`
- `technician`
- `seller`
- `customer`

Fuente legacy:

- `profiles.role`
- `user_roles.role`

Actualmente el registro publico crea:

- `organization_members.role = owner`
- `profiles.role = admin`
- `user_roles.role = admin`

Esto mantiene compatibilidad con el sistema viejo, pero puede confundir si no se documenta que `organization_members` debe ser la fuente SaaS principal.

## Tipo de usuario que deberia registrarse publicamente

Para empresas publicadoras, el unico registro publico recomendado es:

- `company_owner`

Ese usuario representa al dueno de la empresa y debe quedar como:

- `organization_members.role = owner`
- plan inicial `FREE` o `trialing`
- empresa creada
- sucursal principal creada
- permiso para configurar marketplace, productos y usuarios

## Tipos de usuario que NO deberian registrarse publicamente

Estos usuarios no deberian crear cuenta desde `/register` porque dependen de una empresa existente:

- `admin`
- `manager`
- `cashier`
- `technician`
- `seller`

Deben entrar por invitacion del owner/admin de una organizacion.

Motivo:

- necesitan `organization_id`;
- necesitan rol asignado por la empresa;
- no deben poder autoproclamarse staff;
- evita accesos cruzados entre empresas.

## Clientes finales

El rol `customer` debe manejarse separado.

Opciones recomendadas:

1. Cliente sin cuenta:
   - consulta reparaciones con ticket/contacto;
   - compra o consulta productos publicos;
   - no entra al dashboard.

2. Cliente con cuenta:
   - registro desde pagina de empresa;
   - queda vinculado a `customers.profile_id`;
   - puede ver sus reparaciones/pedidos;
   - `organization_members.role = customer` solo si realmente necesita membresia tenant.

## Flujo recomendado

### 1. Registro publico SaaS

Ruta:

- `/register`

Tipo:

- crear empresa

Rol:

- `owner`

Uso:

- nuevos suscriptores;
- empresas que quieren publicar en marketplace;
- negocios que empiezan con POS/inventario/reparaciones.

### 2. Invitacion de usuarios internos

Ruta recomendada futura:

- `/dashboard/settings/users/invite`

Roles permitidos:

- `admin`
- `manager`
- `cashier`
- `technician`
- `seller`

Debe usar:

- `organization_invitations`;
- token seguro;
- expiracion;
- aceptacion por email;
- limite por plan.

### 3. Login unico

Ruta:

- `/login`

Todos los usuarios pueden entrar por la misma pantalla:

- owner
- admin
- manager
- cashier
- technician
- seller
- customer, si aplica
- super_admin

Despues del login, el sistema debe decidir destino:

- super_admin -> `/superadmin`
- owner/admin/manager -> `/dashboard`
- cashier -> `/dashboard/pos`
- technician -> `/dashboard/technician`
- seller -> `/dashboard/products` o POS
- customer -> pagina publica o portal cliente

## Riesgos actuales

- El registro crea `owner` moderno, pero tambien `admin` legacy.
- No hay selector explicito de tipo de registro.
- No hay flujo completo de invitaciones visible.
- No hay separacion visual entre login SaaS, login cliente y login superadmin.
- Si se sigue usando `profiles.role` como fuente principal, se puede perder contexto multiempresa.

## Recomendaciones

1. Mantener `/register` solo para crear empresas.
2. Agregar texto claro: `Crea tu empresa y tu usuario owner`.
3. Agregar flujo de invitacion para staff.
4. Usar `organization_members.role` como fuente principal de permisos SaaS.
5. Mantener `profiles/user_roles` solo como compatibilidad legacy durante la migracion.
6. Crear redireccion post-login basada en rol y organizacion activa.
7. Separar registro de cliente final si se necesita portal de clientes.
