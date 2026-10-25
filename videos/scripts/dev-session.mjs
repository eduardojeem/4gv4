/**
 * Sesión con el usuario sintético de DEV para grabar tutoriales del panel.
 * Solo direcciones locales (go() lo verifica); la contraseña sale de
 * .env.development.local y nunca se imprime.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { go, wait } from './browser.mjs';

export const WEB = 'http://localhost:3000';
export const APP = 'http://localhost:8081';

export function devUser() {
  const env = Object.fromEntries(
    readFileSync(join(import.meta.dirname, '..', '..', '.env.development.local'), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.trim().replace(/^['"]|['"]$/g, '')]),
  );
  const email = env.MOBILE_DEV_OWNER_EMAIL?.trim();
  if (!email?.endsWith('@dev.example.test') || !env.MOBILE_DEV_TEST_PASSWORD) throw new Error('Falta el usuario sintético de DEV en .env.development.local.');
  // El captcha de DEV usa la clave de prueba de Cloudflare, que se valida sola.
  if (!/^1x0+AA$/.test(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '')) throw new Error('El captcha de DEV no es el de prueba: no se inicia sesión automáticamente.');
  return { email, password: env.MOBILE_DEV_TEST_PASSWORD };
}

/** Inicia sesión en la web de DEV (si hace falta) y deja la página en `path`. */
export async function webSignIn(page, path) {
  await go(page, `${WEB}${path}`);
  if (new URL(page.url()).pathname.startsWith(path)) return;
  // Sin sesión el panel manda a otra página: se entra por /login.
  await go(page, `${WEB}/login`);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => /solo esenciales/i.test(button.textContent ?? ''))?.click());
  const user = devUser();
  await page.type('input[type="email"]', user.email);
  await page.type('input[type="password"]', user.password);
  await page.waitForFunction(() => {
    const button = document.querySelector('button[type="submit"]');
    return button && !button.disabled;
  }, { timeout: 30_000 });
  await Promise.all([page.waitForNavigation({ timeout: 60_000 }).catch(() => null), page.click('button[type="submit"]')]);
  await wait(3000);
  if (!new URL(page.url()).pathname.startsWith(path)) await go(page, `${WEB}${path}`);
  await skipOnboarding(page, path);
}

/** El comercio de DEV no terminó los primeros pasos: se posterga la guía para llegar al panel. */
async function skipOnboarding(page, path) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await waitReady(page);
    if (!new URL(page.url()).pathname.startsWith('/admin/onboarding')) return;
    await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => /continuar despu/i.test(button.textContent ?? ''))?.click());
    await wait(2500);
    await go(page, `${WEB}${path}`);
  }
}

/** Inicia sesión en la app (Expo web) de DEV. */
export async function appSignIn(page) {
  const user = devUser();
  await go(page, `${APP}/sign-in`);
  await page.type('input[placeholder="nombre@mitienda.com"]', user.email);
  await page.type('input[type="password"]', user.password);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !location.pathname.startsWith('/sign-in'), { timeout: 60_000 });
  await wait(2000);
}

/** Espera a que el panel termine de cargar (sin pantallas de «Validando…» ni «Cargando…»). */
export async function waitReady(page, timeout = 90_000) {
  await page.waitForFunction(() => {
    const text = document.body?.innerText ?? '';
    return text.length > 200 && !/Validando configuraci|Cargando\.\.\.|Cargando…/i.test(text);
  }, { timeout, polling: 500 });
  await wait(1500);
}

/** Lo que hay para tocar en la pantalla: texto y posición de botones, campos y opciones. */
export async function describe(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight;
    };
    const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || el.getAttribute('name') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    return [...document.querySelectorAll('button, a[href], input, textarea, select, [role="button"], [role="combobox"], [role="tab"], [role="option"]')]
      .filter(visible)
      .map((el) => {
        const box = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()}${el.getAttribute('type') ? `[${el.getAttribute('type')}]` : ''} «${label(el)}» @${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}`;
      });
  });
}
