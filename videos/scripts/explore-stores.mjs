// Vistazo a varias páginas públicas del sitio oficial para elegir cuáles van al video.
import { mkdirSync } from 'node:fs';

import { desktopPage, goPublic, openBrowser, phonePage, wait } from './browser.mjs';

const SITE = 'https://www.mitiendapy.com';
const pages = [
  ['desktop', '/marketplace/empresas', 'empresas'],
  ['desktop', '/tecno-store/inicio', 'tecno-store'],
  ['desktop', '/4g-celulares/inicio', '4g-celulares'],
  ['desktop', '/marcos-tech/inicio', 'marcos-tech'],
  ['desktop', '/hca-celular/inicio', 'hca-celular'],
  ['phone', '/marketplace', 'inicio-movil'],
];
mkdirSync('out/explorar', { recursive: true });
const browser = await openBrowser();
try {
  for (const [kind, path, name] of pages) {
    const page = kind === 'phone' ? await phonePage(browser) : await desktopPage(browser);
    await goPublic(page, `${SITE}${path}`);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => /solo esenciales/i.test(button.textContent ?? ''))?.click());
    await wait(3000);
    await page.screenshot({ path: `out/explorar/${name}.png` });
    console.log(`✓ ${name}`);
    await page.close();
  }
} finally {
  await browser.close();
}
