-- Global platform catalogs must only be mutated by SuperAdmins. Tenant-level
-- admins can still read these catalogs, but cannot alter shared data.

DROP POLICY IF EXISTS "global_categories_superadmin_delete" ON public.global_categories;
DROP POLICY IF EXISTS "global_categories_superadmin_insert" ON public.global_categories;
DROP POLICY IF EXISTS "global_categories_superadmin_update" ON public.global_categories;

CREATE POLICY "global_categories_superadmin_delete"
ON public.global_categories FOR DELETE TO authenticated
USING (public.get_jwt_role() = 'super_admin');

CREATE POLICY "global_categories_superadmin_insert"
ON public.global_categories FOR INSERT TO authenticated
WITH CHECK (public.get_jwt_role() = 'super_admin');

CREATE POLICY "global_categories_superadmin_update"
ON public.global_categories FOR UPDATE TO authenticated
USING (public.get_jwt_role() = 'super_admin')
WITH CHECK (public.get_jwt_role() = 'super_admin');

DROP POLICY IF EXISTS "atributos_variante_actualizar_unificado" ON public.variant_attributes;
DROP POLICY IF EXISTS "atributos_variante_crear_unificado" ON public.variant_attributes;
DROP POLICY IF EXISTS "atributos_variante_eliminar_unificado" ON public.variant_attributes;

CREATE POLICY "atributos_variante_actualizar_unificado"
ON public.variant_attributes FOR UPDATE TO authenticated
USING (public.get_jwt_role() = 'super_admin')
WITH CHECK (public.get_jwt_role() = 'super_admin');

CREATE POLICY "atributos_variante_crear_unificado"
ON public.variant_attributes FOR INSERT TO authenticated
WITH CHECK (public.get_jwt_role() = 'super_admin');

CREATE POLICY "atributos_variante_eliminar_unificado"
ON public.variant_attributes FOR DELETE TO authenticated
USING (public.get_jwt_role() = 'super_admin');

DROP POLICY IF EXISTS "opciones_atributo_variante_actualizar_unificado" ON public.variant_attribute_options;
DROP POLICY IF EXISTS "opciones_atributo_variante_crear_unificado" ON public.variant_attribute_options;
DROP POLICY IF EXISTS "opciones_atributo_variante_eliminar_unificado" ON public.variant_attribute_options;

CREATE POLICY "opciones_atributo_variante_actualizar_unificado"
ON public.variant_attribute_options FOR UPDATE TO authenticated
USING (public.get_jwt_role() = 'super_admin')
WITH CHECK (public.get_jwt_role() = 'super_admin');

CREATE POLICY "opciones_atributo_variante_crear_unificado"
ON public.variant_attribute_options FOR INSERT TO authenticated
WITH CHECK (public.get_jwt_role() = 'super_admin');

CREATE POLICY "opciones_atributo_variante_eliminar_unificado"
ON public.variant_attribute_options FOR DELETE TO authenticated
USING (public.get_jwt_role() = 'super_admin');

-- Authors keep ownership of their posts. Only a SuperAdmin may override the
-- owner boundary for platform moderation.
DROP POLICY IF EXISTS "posts_delete_unified" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_unified" ON public.posts;
DROP POLICY IF EXISTS "posts_select_unified" ON public.posts;
DROP POLICY IF EXISTS "posts_update_unified" ON public.posts;

CREATE POLICY "posts_delete_unified"
ON public.posts FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.get_jwt_role() = 'super_admin');

CREATE POLICY "posts_insert_unified"
ON public.posts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.get_jwt_role() = 'super_admin');

CREATE POLICY "posts_select_unified"
ON public.posts FOR SELECT
USING (status = 'published' OR user_id = auth.uid() OR public.get_jwt_role() = 'super_admin');

CREATE POLICY "posts_update_unified"
ON public.posts FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.get_jwt_role() = 'super_admin')
WITH CHECK (user_id = auth.uid() OR public.get_jwt_role() = 'super_admin');

-- The settings audit is platform-wide and may contain security-sensitive
-- metadata. It is not an organization-admin audit trail.
DROP POLICY IF EXISTS "Solo admins pueden insertar en audit log" ON public.system_settings_audit;
DROP POLICY IF EXISTS "Solo admins pueden ver audit log" ON public.system_settings_audit;
DROP POLICY IF EXISTS "Solo SuperAdmins pueden insertar en audit log" ON public.system_settings_audit;
DROP POLICY IF EXISTS "Solo SuperAdmins pueden ver audit log" ON public.system_settings_audit;

CREATE POLICY "Solo SuperAdmins pueden insertar en audit log"
ON public.system_settings_audit FOR INSERT TO authenticated
WITH CHECK (public.get_jwt_role() = 'super_admin');

CREATE POLICY "Solo SuperAdmins pueden ver audit log"
ON public.system_settings_audit FOR SELECT TO authenticated
USING (public.get_jwt_role() = 'super_admin');
