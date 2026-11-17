-- Lectura de turnos propios desde la ficha vinculada al perfil.
-- No cambia permisos, estados, registros ni la asociación de clientes.
create index if not exists idx_appointments_customer_timeline
  on public.appointments (customer_id, starts_at, id)
  where customer_id is not null;