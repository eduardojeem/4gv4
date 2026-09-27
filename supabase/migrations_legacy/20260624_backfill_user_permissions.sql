-- Backfill: unificar el almacenamiento de permisos específicos en user_permissions.
--
-- Contexto: hoy los permisos específicos viven en DOS lugares:
--   1) profiles.permissions (columna array, escrita por el PUT de /api/admin/users)
--   2) public.user_permissions (tabla, fuente preferida en la lectura)
-- Esta migración copia a user_permissions cualquier permiso que solo esté en
-- profiles.permissions, para poder dejar user_permissions como ÚNICA fuente de
-- verdad y luego retirar la columna profiles.permissions.
--
-- Es idempotente: solo inserta lo que falta como activo.
-- Agnóstica al tipo de profiles.permissions (text[] o jsonb) vía to_jsonb().

INSERT INTO public.user_permissions (user_id, permission, is_active, granted_at)
SELECT
  p.id,
  perm.value,
  true,
  now()
FROM public.profiles p
CROSS JOIN LATERAL jsonb_array_elements_text(to_jsonb(p.permissions)) AS perm(value)
WHERE p.permissions IS NOT NULL
  AND jsonb_typeof(to_jsonb(p.permissions)) = 'array'
  AND jsonb_array_length(to_jsonb(p.permissions)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = p.id
      AND up.permission = perm.value
      AND up.is_active = true
  );

-- Verificación rápida (opcional, comentar si no se necesita en CI):
-- SELECT p.id, p.permissions,
--        array_agg(up.permission) FILTER (WHERE up.is_active) AS in_table
-- FROM public.profiles p
-- LEFT JOIN public.user_permissions up ON up.user_id = p.id
-- WHERE p.permissions IS NOT NULL AND jsonb_array_length(to_jsonb(p.permissions)) > 0
-- GROUP BY p.id, p.permissions;
