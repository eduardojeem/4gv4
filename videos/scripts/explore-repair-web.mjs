// Exploración: la pantalla de Reparaciones de la web y el formulario de nueva reparación.
import { mkdirSync } from 'node:fs';

import { desktopPage, openBrowser, wait } from './browser.mjs';
import { describe, waitReady, webSignIn } from './dev-session.mjs';

mkdirSync('out/explorar', { recursive: true });
const browser = await openBrowser();
try {
  const page = await desktopPage(browser);
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await webSignIn(page, '/dashboard/repairs');
  await waitReady(page);
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  console.log('URL', page.url());
  await page.screenshot({ path: 'out/explorar/web-1.png' });
  console.log((await describe(page)).join('\n'));
  const step = process.argv[2];
  if (step) {
    const target = await page.evaluateHandle((text) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim().includes(text)), step);
    await target.asElement()?.click();
    await wait(2500);
    await page.screenshot({ path: 'out/explorar/web-2.png' });
    console.log('\n--- después de tocar', step);
    console.log((await describe(page)).join('\n'));
  }
} finally {
  await browser.close();
}
