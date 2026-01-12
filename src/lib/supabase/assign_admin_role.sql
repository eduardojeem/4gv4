-- Script para asignar rol de administrador al usuario
-- ID: 4b187415-52a5-4bbf-ab82-185e167782cd
-- Email: johneduardoespinoza95@gmail.com

-- 1. Insertar o actualizar el rol en la tabla user_roles
INSERT INTO public.user_roles (user_id, role)
VALUES ('4b187415-52a5-4bbf-ab82-185e167782cd', 'admin')
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = 'admin',
  updated_at = NOW();

-- 2. (Opcional) Verificar que el perfil exista
INSERT INTO public.profiles (id, name)
VALUES ('4b187415-52a5-4bbf-ab82-185e167782cd', 'John Eduardo Espinoza')
ON CONFLICT (id) DO NOTHING;

-- Verificación
SELECT * FROM public.user_roles WHERE user_id = '4b187415-52a5-4bbf-ab82-185e167782cd';
