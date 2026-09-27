-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for parent_id to speed up tree queries
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow all authenticated users to view categories
CREATE POLICY "Authenticated users can view categories" 
ON public.categories FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users to insert categories
CREATE POLICY "Authenticated users can insert categories" 
ON public.categories FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow authenticated users to update categories
CREATE POLICY "Authenticated users can update categories" 
ON public.categories FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete categories
CREATE POLICY "Authenticated users can delete categories" 
ON public.categories FOR DELETE 
TO authenticated 
USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some initial categories (optional, but helpful)
INSERT INTO public.categories (name, description, is_active)
VALUES 
    ('Electrónica', 'Dispositivos electrónicos y gadgets', true),
    ('Ropa', 'Prendas de vestir para hombre y mujer', true),
    ('Hogar', 'Artículos para el hogar y decoración', true)
ON CONFLICT DO NOTHING;
