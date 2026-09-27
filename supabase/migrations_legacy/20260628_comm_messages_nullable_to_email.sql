-- communication_messages es una tabla compartida entre el módulo de email/campañas
-- (que sí usa to_email) y el de comunicaciones de reparaciones (WhatsApp/SMS, sin email).
-- La columna to_email quedó NOT NULL al fusionar el esquema de email, lo que rompía
-- el guardado de mensajes de reparación por canales sin email.
-- to_email solo es relevante para el canal email -> debe ser nullable.

ALTER TABLE public.communication_messages
  ALTER COLUMN to_email DROP NOT NULL;
