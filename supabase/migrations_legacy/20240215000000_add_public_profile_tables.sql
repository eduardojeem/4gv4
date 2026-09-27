-- Tabla de perfiles públicos
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT CHECK (LENGTH(bio) <= 500),
  avatar_url TEXT,
  location VARCHAR(100),
  title VARCHAR(100),
  is_public BOOLEAN DEFAULT true,
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de enlaces sociales
CREATE TABLE IF NOT EXISTS public.social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'github', 'website', 'instagram')),
  url TEXT NOT NULL CHECK (url ~ '^https?://.+'),
  username VARCHAR(100),
  is_verified BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de estadísticas de usuario
CREATE TABLE IF NOT EXISTS public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  projects_count INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de contenido (publicaciones y proyectos)
CREATE TABLE IF NOT EXISTS public.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  category VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('post', 'project')),
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  link TEXT,
  tags TEXT[], -- Array de strings para PostgreSQL
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_public ON public.profiles(is_public);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_category ON public.profiles(category);
CREATE INDEX IF NOT EXISTS idx_social_links_user_id ON public.social_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON public.user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_content_user_id ON public.content(user_id);
CREATE INDEX IF NOT EXISTS idx_content_is_public ON public.content(is_public);
CREATE INDEX IF NOT EXISTS idx_content_type ON public.content(type);
CREATE INDEX IF NOT EXISTS idx_content_date ON public.content(date);

-- Función para actualizar el timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at en profiles
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Políticas de seguridad RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Perfiles públicos son legibles" ON public.profiles
  FOR SELECT USING (is_public = true);

CREATE POLICY "Usuarios pueden ver su propio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden insertar su propio perfil" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para social_links
CREATE POLICY "Enlaces sociales públicos son legibles" ON public.social_links
  FOR SELECT USING (
    user_id IN (
      SELECT user_id FROM public.profiles WHERE is_public = true
    )
  );

CREATE POLICY "Usuarios pueden ver sus propios enlaces" ON public.social_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden gestionar sus enlaces" ON public.social_links
  FOR ALL USING (auth.uid() = user_id);

-- Políticas para user_stats
CREATE POLICY "Estadísticas públicas son legibles" ON public.user_stats
  FOR SELECT USING (
    user_id IN (
      SELECT user_id FROM public.profiles WHERE is_public = true
    )
  );

CREATE POLICY "Usuarios pueden ver sus propias estadísticas" ON public.user_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar sus estadísticas" ON public.user_stats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden insertar sus estadísticas" ON public.user_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para content
CREATE POLICY "Contenido público es legible" ON public.content
  FOR SELECT USING (is_public = true);

CREATE POLICY "Usuarios pueden ver su propio contenido" ON public.content
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden gestionar su contenido" ON public.content
  FOR ALL USING (auth.uid() = user_id);

-- Permisos básicos
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO authenticated;
GRANT SELECT ON public.social_links TO anon;
GRANT ALL ON public.social_links TO authenticated;
GRANT SELECT ON public.user_stats TO anon;
GRANT ALL ON public.user_stats TO authenticated;
GRANT SELECT ON public.content TO anon;
GRANT ALL ON public.content TO authenticated;

-- Función para crear perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    LOWER(REPLACE(NEW.email, '@', '_')),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
  );
  
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();