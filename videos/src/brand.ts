import { staticFile } from 'remotion';

/** Colores, tipografía y logo compartidos por todos los videos. */
export const BLUE = '#2563EB';
export const DARK = '#0F172A';
export const NAVY = '#0B1220';
export const CYAN = '#22D3EE';
export const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

/** Logo oficial (el del encabezado del sitio), recortado para fondo oscuro. */
export const LOGO_DARK_BG = staticFile('branding/logo-oscuro.png');

/** Fondo de marca: azul noche con un halo celeste, como el logo. */
export const BRAND_BACKGROUND = `radial-gradient(circle at 50% 42%, rgba(14,165,233,0.35), transparent 55%), linear-gradient(170deg, ${NAVY}, #1E3A8A)`;
