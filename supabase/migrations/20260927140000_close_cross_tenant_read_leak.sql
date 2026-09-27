-- Cierra una fuga de lectura entre organizaciones.
--
-- Seis tablas tenian, ademas de su politica RLS correcta -filtrada por
-- organizacion via has_org_permission()-, una segunda politica "permissive"
-- sin ningun filtro (`auth.role() = 'authenticated'`). Las politicas
-- permissive se unen con OR: la sola presencia de la politica sin filtro le
-- daba a cualquier usuario logueado, de cualquier organizacion, lectura
-- completa de cierres de caja, cajas, cuotas de credito, pagos de credito,
-- saldo de credito de clientes y variantes de producto de TODAS las
-- organizaciones de la plataforma.
--
-- El Security Advisor no lo marca porque su chequeo es "¿existe una
-- politica?", no "¿la politica filtra algo?". Lo encontramos al traer el
-- texto de cada politica para resolver un aviso de Performance Advisor sobre
-- politicas multiples.
--
-- El arreglo es solo borrar las 6 politicas sin filtro. La politica que si
-- filtra por organizacion ya existe en cada una de las 6 tablas, asi que el
-- acceso dentro de la propia organizacion sigue igual.

begin;

drop policy if exists "autenticados pueden leer cierres_caja" on public.cash_closures;
drop policy if exists "autenticados pueden leer cajas" on public.cash_registers;
drop policy if exists "Authenticated can read installments" on public.credit_installments;
drop policy if exists "Authenticated can read payments" on public.credit_payments;
drop policy if exists "Authenticated can read credits" on public.customer_credits;
drop policy if exists "usuarios autenticados pueden ver variantes" on public.product_variants;

commit;
