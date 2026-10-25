// Exploración del sitio oficial (solo páginas públicas): captura y enlaces de tiendas y productos.
import { mkdirSync } from 'node:fs';

import { desktopPage, goPublic, openBrowser, phonePage, wait } from './browser.mjs';

const url = process.argv[2] ?? 'https://www.mitiendapy.com/';
const file = process.argv[3] ?? 'out/capturas/publico.png';
const mobile = process.argv.includes('--movil');
mkdirSync('out/capturas', { recursive: true });
const browser = await openBrowser();
try {
  const page = mobile ? await phonePage(browser) : await desktopPage(browser);
  await goPublic(page, url);
  await wait(3000);
  await page.screenshot({ path: file });
  const links = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))].filter((href) => /productos\/|\/inicio|empresas/.test(href ?? '')).slice(0, 40));
  console.log(JSON.stringify({ url: page.url(), links }, null, 1));
} finally {
  await browser.close();
}
