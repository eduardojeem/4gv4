// Exploración: qué muestra una pantalla y qué botones tiene (para armar las capturas).
import { mkdirSync } from 'node:fs';

import { go, openBrowser, phonePage, wait } from './browser.mjs';

const url = process.argv[2] ?? 'http://localhost:8081/';
const file = process.argv[3] ?? 'out/capturas/explorar.png';
mkdirSync('out/capturas', { recursive: true });
const browser = await openBrowser();
try {
  const page = await phonePage(browser);
  const errors = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text().slice(0, 160)));
  await go(page, url);
  await wait(4000);
  await page.screenshot({ path: file });
  const info = await page.evaluate(() => ({
    title: document.title,
    labels: [...document.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label')).slice(0, 40),
    inputs: [...document.querySelectorAll('input, textarea')].map((el) => el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.type),
  }));
  console.log(JSON.stringify({ url: page.url(), ...info, errors: errors.slice(0, 5) }, null, 1));
} finally {
  await browser.close();
}
