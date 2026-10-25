/**
 * Saca las capturas que usa el video, del sitio oficial www.mitiendapy.com.
 * Solo páginas públicas, como cualquier visitante: sin iniciar sesión ni
 * completar formularios. Las capturas quedan en public/capturas/.
 *
 *   npm run capturas
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { desktopPage, goPublic, openBrowser, phonePage, wait } from './browser.mjs';

const OFFICIAL = 'https://www.mitiendapy.com';
const OFFICIAL_STORE = 'storecenter';
const OFFICIAL_PRODUCT = '2ebf29b1-578b-4f17-bf65-e7a8320c6930';
const OFFICIAL_WEB_STORE = 'tecno-store';
const OUT = join(import.meta.dirname, '..', 'public', 'capturas');

/**
 * Abre una página pública y la deja limpia para la foto: cookies en «Solo
 * esenciales» y la burbuja de ayuda cerrada (el botón de WhatsApp queda).
 */
async function openOfficial(page, path) {
  await goPublic(page, `${OFFICIAL}${path}`);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => /solo esenciales/i.test(button.textContent ?? ''))?.click());
  // La burbuja aparece a los pocos segundos de abrir la página.
  await wait(3500);
  await page.evaluate(() => {
    for (const button of document.querySelectorAll('button[aria-label="Cerrar"]')) {
      if (/necesit.s ayuda/i.test(button.parentElement?.textContent ?? '')) button.click();
    }
  });
}

/** Baja hasta `y` de a poco, para que se disparen las animaciones de entrada. */
async function scrollTo(page, y) {
  await page.evaluate(async (target) => {
    for (let at = 0; at <= target; at += 300) {
      window.scrollTo(0, at);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, target);
  }, y);
}

async function shot(page, name) {
  await wait(2500);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`✓ ${name}.png`);
}

mkdirSync(OUT, { recursive: true });
const browser = await openBrowser();
try {
  const desktop = await desktopPage(browser);
  await openOfficial(desktop, '/marketplace');
  // Las ofertas con fotos, más abajo en la misma página.
  await scrollTo(desktop, 880);
  await shot(desktop, 'oficial-ofertas');
  await openOfficial(desktop, '/marketplace/empresas');
  await shot(desktop, 'oficial-empresas');
  await openOfficial(desktop, `/${OFFICIAL_WEB_STORE}/inicio`);
  await shot(desktop, 'oficial-tienda');
  // Ventas y caja + Productos e inventario.
  await openOfficial(desktop, '/saas/soluciones');
  await scrollTo(desktop, 600);
  await shot(desktop, 'oficial-soluciones');
  await openOfficial(desktop, '/saas/planes');
  await scrollTo(desktop, 30);
  await shot(desktop, 'oficial-planes');

  const mobile = await phonePage(browser);
  await openOfficial(mobile, '/marketplace');
  await shot(mobile, 'oficial-inicio-movil');
  await openOfficial(mobile, `/${OFFICIAL_STORE}/productos/${OFFICIAL_PRODUCT}`);
  await shot(mobile, 'oficial-producto-movil');
  await openOfficial(mobile, '/saas');
  await shot(mobile, 'oficial-sistema-movil');
} finally {
  await browser.close();
}
