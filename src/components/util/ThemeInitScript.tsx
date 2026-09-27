'use client'

import { useServerInsertedHTML } from 'next/navigation'

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
// Este script y `ThemeProvider` tienen que decidir igual: si uno pone claro y el
// otro oscuro, se ve el parpadeo que este script existe para evitar.
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var theme = localStorage.getItem('theme');

    // Clave vieja del panel admin, que el proveedor tambien respeta.
    if (!theme) {
      var legacy = localStorage.getItem('admin-dark-mode');
      if (legacy !== null) theme = legacy === 'true' ? 'dark' : 'light';
    }

    var systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = theme === 'dark' || (theme === 'system' && systemPrefersDark);

    document.documentElement.classList.add(dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.classList.add('light');
  }
})()
`

export function ThemeInitScript() {
  useServerInsertedHTML(() => (
    <script
      id="theme-init"
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
    />
  ))
  return null
}
