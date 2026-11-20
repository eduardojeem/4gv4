'use client'

import { useServerInsertedHTML } from 'next/navigation'
import { SYSTEM_COLOR_SCHEME_VALUES } from '@/lib/theme/color-schemes'
import { PANEL_STYLES } from '@/lib/theme/panel-appearance'
import {
  DEFAULT_MARKETPLACE_THEME,
  MARKETPLACE_PATH_PREFIXES,
  PANEL_PATH_PREFIXES,
  PANEL_THEME_STORAGE_KEY,
  PUBLIC_THEME_STORAGE_KEY,
  normalizeMarketplaceTheme,
  type MarketplaceTheme,
} from '@/lib/theme/theme-scope'

// Script anti-flash de tema: fija la clase dark/light en <html> antes de que
// React hidrate, para no mostrar un parpadeo del tema equivocado.
//
// Por qué useServerInsertedHTML y no un <script>/<Script> normal en el
// layout: Next.js 16 + React 19 loguean "Encountered a script tag while
// rendering React component" para CUALQUIER <script> renderizado por un
// componente (probado con <script> crudo y con next/script
// strategy="beforeInteractive" — ambos disparan el mismo warning, porque
// React igual los trata como un elemento que reconcilia). Es un warning
// conocido y ya reportado contra next-themes, shadcn/ui y HeroUI con Next
// 16.2+; el script SÍ se ejecuta bien en SSR, pero React desconfía de
// cualquier <script> que pueda terminar renderizándose del lado cliente
// (p.ej. durante Fast Refresh). useServerInsertedHTML es el mecanismo que
// Next.js expone para inyectar HTML directo en el stream de SSR (el mismo
// que usan las libs de CSS-in-JS para inyectar <style>) sin que React lo
// trate como un elemento reconciliable — por eso no dispara el warning.
// El modo por defecto es claro: quien nunca eligio tema abre en claro, aunque
// su sistema este en oscuro. Solo se va a oscuro con una decision explicita
// —'dark', o 'system' con el sistema en oscuro—.
//
// Decide por zona igual que `ThemeProvider` (ver lib/theme/theme-scope): el
// tema personal solo en el panel, el del superadmin en el marketplace y el del
// visitante en las tiendas. Si uno pone claro y el otro oscuro, se ve el
// parpadeo que este script existe para evitar.
export function buildThemeInitScript(marketplaceTheme: MarketplaceTheme = DEFAULT_MARKETPLACE_THEME) {
  const marketplace = normalizeMarketplaceTheme(marketplaceTheme)
  return `
(function() {
  try {
    var path = window.location.pathname;
    var inside = function(prefixes) {
      for (var i = 0; i < prefixes.length; i++) {
        var p = prefixes[i];
        if (path === p || path.indexOf(p + '/') === 0) return true;
      }
      return false;
    };
    var scope = inside(${JSON.stringify(PANEL_PATH_PREFIXES)}) ? 'panel'
      : inside(${JSON.stringify(MARKETPLACE_PATH_PREFIXES)}) ? 'marketplace' : 'public';
    var theme = null;
    var scheme = null;

    if (scope === 'panel') {
      theme = localStorage.getItem('${PANEL_THEME_STORAGE_KEY}');
      // Clave vieja del panel admin, que el proveedor tambien respeta.
      if (!theme) {
        var legacy = localStorage.getItem('admin-dark-mode');
        if (legacy !== null) theme = legacy === 'true' ? 'dark' : 'light';
      }
      scheme = localStorage.getItem('colorScheme');
    } else if (scope === 'marketplace') {
      theme = ${JSON.stringify(marketplace.mode)};
      scheme = ${JSON.stringify(marketplace.colorScheme)};
    } else {
      theme = localStorage.getItem('${PUBLIC_THEME_STORAGE_KEY}');
    }

    var systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = theme === 'dark' || (theme === 'system' && systemPrefersDark);

    document.documentElement.classList.add(dark ? 'dark' : 'light');
    if (scheme && scheme !== 'custom' && ${JSON.stringify(SYSTEM_COLOR_SCHEME_VALUES)}.indexOf(scheme) < 0 && scheme !== 'default') scheme = null;
    if (scheme && scheme !== 'custom') document.documentElement.setAttribute('data-color-scheme', scheme);
    // El estilo del panel solo pinta dentro de [data-panel-shell] (styles/panel-appearance.css).
    var panelStyle = localStorage.getItem('panelStyle');
    document.documentElement.setAttribute('data-panel-style', ${JSON.stringify(PANEL_STYLES)}.indexOf(panelStyle) >= 0 ? panelStyle : 'neutral');
  } catch (e) {
    document.documentElement.classList.add('light');
  }
})()
`
}

export function ThemeInitScript({ marketplaceTheme }: { marketplaceTheme?: MarketplaceTheme }) {
  useServerInsertedHTML(() => (
    <script
      id="theme-init"
      dangerouslySetInnerHTML={{ __html: buildThemeInitScript(marketplaceTheme) }}
    />
  ))
  return null
}
