-- Asegurar que la columna parent_id existe en categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'categories' 
    AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN parent_id uuid;
  END IF;
END $$;

-- Agregar foreign key constraint si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_id_fkey'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_parent_id_fkey
      FOREIGN KEY (parent_id)
      REFERENCES public.categories (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Crear índice para mejorar consultas de jerarquía
CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories(parent_id);

-- Agregar comentarios para documentación
COMMENT ON COLUMN public.categories.parent_id IS 'ID de la categoría padre para crear jerarquías (subcategorías)';
