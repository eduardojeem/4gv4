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
const THEME_INIT_SCRIPT = `
(function() {
  try {
    const theme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (theme === 'dark' || (!theme && systemPrefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light');
    }
  } catch (e) {}
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
