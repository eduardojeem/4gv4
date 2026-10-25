/**
 * Ejecuta un paso de exploración sobre el Chrome abierto por keep-browser.mjs:
 *   node scripts/step.mjs <acciones.mjs> [nombre-captura] [web|app]
 * <acciones.mjs> exporta por defecto async (page, helpers) => {}.
 */
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { connectBrowser, wait } from './browser.mjs';
import * as session from './dev-session.mjs';

const [actionsFile, name = 'paso', kind = 'web'] = process.argv.slice(2);
mkdirSync('out/explorar', { recursive: true });
const browser = await connectBrowser();
try {
  const pages = await browser.pages();
  let page = pages.find((item) => item.url().startsWith(kind === 'app' ? session.APP : session.WEB));
  page ??= await browser.newPage();
  // El tamaño emulado se pierde al desconectarse: se vuelve a fijar en cada paso.
  // Sin isMobile/hasTouch: cambiarlos recarga la página y se pierde lo cargado.
  if (kind === 'app') await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  else await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const actions = (await import(pathToFileURL(actionsFile).href)).default;
  await actions(page, { ...session, wait });
  await wait(1200);
  await page.screenshot({ path: `out/explorar/${name}.png` });
  console.log('URL', page.url());
  console.log((await session.describe(page)).join('\n'));
} finally {
  browser.disconnect();
}
