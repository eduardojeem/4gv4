/**
 * Abre el Chrome que ya bajó Remotion (no descarga otro) para sacar capturas
 * del sistema corriendo en DEV local. Nunca apunta a producción.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = join(import.meta.dirname, '..', 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');

const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?\//;

export async function openBrowser({ args = [] } = {}) {
  if (!existsSync(CHROME)) throw new Error('Falta el Chrome de Remotion: corré primero `npm run still`.');
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--hide-scrollbars', ...args] });
}

/** Se conecta al Chrome que dejó abierto keep-browser.mjs. */
export const connectBrowser = () => puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });

/** Un teléfono de 390×844 a 3x (como un iPhone 14). */
export async function phonePage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  return page;
}

/** Una pantalla de computadora de 1440×900 a 2x. */
export async function desktopPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  return page;
}

export async function go(page, url) {
  if (!LOCAL.test(url)) throw new Error(`Solo se capturan direcciones locales de DEV: ${url}`);
  // El panel mantiene conexiones abiertas (tiempo real): no se espera a que la red quede quieta.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForNetworkIdle({ idleTime: 800, concurrency: 4, timeout: 30_000 }).catch(() => {});
}

/**
 * El sitio oficial solo se mira como cualquier visitante: páginas públicas,
 * sin iniciar sesión ni completar formularios.
 */
const PUBLIC_SITE = /^https:\/\/www\.mitiendapy\.com\//;

export async function goPublic(page, url) {
  if (!PUBLIC_SITE.test(url)) throw new Error(`Solo páginas públicas de www.mitiendapy.com: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90_000 });
}

export const wait =(ms) => new Promise((resolve) => setTimeout(resolve, ms));
