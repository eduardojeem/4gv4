import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { secureStorage } from './secure-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en mobile/.env.local');
}

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
