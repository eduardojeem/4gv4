import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { secureStorage } from './secure-storage';

const DEFAULT_SUPABASE_URL = 'https://cswtugmwazxdktntndpy.supabase.co';
const DEFAULT_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzd3R1Z213YXp4ZGt0bnRuZHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTQ0MzgsImV4cCI6MjA3OTQ5MDQzOH0.JtXcBW3E1bEz59zfKNG2IWxzyVslpE_M1cWG6JeUT_g';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;

// Mismos usuarios que la web. La sesión queda guardada cifrada en el teléfono,
// así que no hay que volver a iniciar sesión cada vez que se abre la app.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renovar el token solo con la app en pantalla. Al abrirla no hay evento de
// cambio (ya está activa), así que también se arranca acá.
if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
