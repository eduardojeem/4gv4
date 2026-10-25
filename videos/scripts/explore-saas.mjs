// Vistazo de página completa a las páginas públicas que presentan el sistema.
import { mkdirSync } from 'node:fs';

import { desktopPage, goPublic, openBrowser, wait } from './browser.mjs';

const SITE = 'https://www.mitiendapy.com';
mkdirSync('out/explorar', { recursive: true });
const browser = await openBrowser();
try {
  for (const path of ['/saas', '/saas/soluciones', '/saas/planes', '/saas/negocios']) {
    const page = await desktopPage(browser);
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await goPublic(page, `${SITE}${path}`);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => /solo esenciales/i.test(button.textContent ?? ''))?.click());
    // Bajar de a poco para que carguen las animaciones y las imágenes diferidas.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
      window.scrollTo(0, 0);
    });
    await wait(1500);
    const name = path.replaceAll('/', '_').slice(1);
    await page.screenshot({ path: `out/explorar/${name}.png`, fullPage: true });
    const headings = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3')].map((h) => `${h.tagName} ${Math.round(h.getBoundingClientRect().top + scrollY)} ${h.textContent?.trim().slice(0, 70)}`));
    console.log(`\n== ${path} (${page.url()})\n${headings.slice(0, 40).join('\n')}`);
    await page.close();
  }
} finally {
  await browser.close();
}
