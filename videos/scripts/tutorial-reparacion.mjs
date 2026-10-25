/**
 * Graba el tutorial «Cómo crear una nueva reparación» en DEV (datos de prueba):
 * hace el recorrido real en la web y en la app, saca una captura por paso y
 * anota dónde se toca. Deja public/tutorial/<web|app>/NN.png y <web|app>.json.
 *
 *   npm run tutorial:capturas            web y app
 *   npm run tutorial:capturas -- web     solo la web
 *
 * Crea una reparación de prueba por recorrido en la base local; al final
 * imprime el número para borrarla.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { go, openBrowser, wait } from './browser.mjs';
import { APP, appSignIn, waitReady, webSignIn } from './dev-session.mjs';

const OUT = join(import.meta.dirname, '..', 'public', 'tutorial');
const CUSTOMER = 'Cliente Demo 05';
const BRAND = 'Samsung';
const MODEL = 'Galaxy A34';
const PROBLEM_NOTE = 'Se cayó y la pantalla quedó negra. El táctil no responde.';
const LABOR = '350000';

/** Busca un elemento visible por texto o aria-label. */
async function find(page, selector, matcher, { timeout = 30_000 } = {}) {
  const handle = await page.waitForFunction(
    (sel, source, flags) => {
      const re = new RegExp(source, flags);
      // El último que coincide: los diálogos y pantallas nuevas quedan al final, encima de lo de atrás.
      return [...document.querySelectorAll(sel)].findLast((el) => {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return false;
        return re.test((el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || '').trim());
      });
    },
    { timeout, polling: 300 },
    selector,
    matcher.source,
    matcher.flags,
  );
  return handle.asElement();
}

/**
 * Centra el elemento moviendo solo el contenedor con scroll que lo contiene
 * (scrollIntoView desacomoda el formulario de la web).
 */
async function reveal(element) {
  await element.evaluate((el) => {
    let box = el.parentElement;
    while (box && !(/(auto|scroll)/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight)) box = box.parentElement;
    if (!box) return;
    const target = el.getBoundingClientRect();
    const frame = box.getBoundingClientRect();
    box.scrollTop += target.top + target.height / 2 - (frame.top + frame.height / 2);
  });
  await wait(500);
}

/** Toque real del mouse en el centro del elemento. */
async function tap(page, element) {
  const box = await element.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Escribe al final de lo que ya tenga el campo (el toque deja el cursor donde cae). */
async function typeInto(page, element, text) {
  await tap(page, element);
  await page.keyboard.down('Control');
  await page.keyboard.press('End');
  await page.keyboard.up('Control');
  await page.keyboard.type(text, { delay: 35 });
}

function recorder(kind, page, viewport) {
  const dir = join(OUT, kind);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const steps = [];
  return {
    steps,
    async snap(caption, element) {
      await wait(900);
      const name = `${String(steps.length + 1).padStart(2, '0')}.png`;
      const box = element ? await element.boundingBox() : null;
      await page.screenshot({ path: join(dir, name) });
      steps.push({ image: `tutorial/${kind}/${name}`, caption, target: box && { x: box.x, y: box.y, width: box.width, height: box.height } });
      console.log(`  ✓ ${kind} ${name} ${caption}`);
    },
    save(extra) {
      writeFileSync(join(OUT, `${kind}.json`), `${JSON.stringify({ viewport, steps, ...extra }, null, 2)}\n`);
    },
  };
}

async function recordWeb(browser) {
  const viewport = { width: 1440, height: 900 };
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 2 });
  await webSignIn(page, '/dashboard/repairs');
  await waitReady(page);
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  const rec = recorder('web', page, viewport);

  const create = await find(page, 'button', /^Nueva reparación/);
  await rec.snap('Entrá a Reparaciones y tocá «Nueva reparación».', create);
  await tap(page, create);

  await tap(page, await find(page, 'button', /Selecciona o crea un cliente/));
  await typeInto(page, await find(page, 'input', /^Buscar por nombre, teléfono/), 'Demo 05');
  const customer = await find(page, 'button', new RegExp(`^${CUSTOMER}`));
  await rec.snap('Buscá al cliente por nombre o teléfono y elegilo.', customer);
  await tap(page, customer);
  // La lista de clientes tarda en cerrarse: si se sigue enseguida, el toque siguiente cierra el formulario.
  await wait(1500);

  const brand = await find(page, 'input', /^Apple, Samsung/);
  await reveal(brand);
  await typeInto(page, brand, BRAND);
  const model = await find(page, 'input', /^iPhone 15 Pro/);
  await typeInto(page, model, MODEL);
  await rec.snap('Cargá la marca y el modelo del equipo.', model);

  const problem = await find(page, 'button', /^📱 Pantalla \/ Módulo$/);
  await reveal(problem);
  await tap(page, problem);
  await typeInto(page, await find(page, 'textarea', /^Describe el problema en detalle/), PROBLEM_NOTE);
  await reveal(problem);
  await rec.snap('Elegí el problema con un toque y sumá detalles.', problem);

  await tap(page, await find(page, 'button', /Costos y plazo/));
  await wait(1200);
  const labor = await page.evaluateHandle(() => {
    const title = [...document.querySelectorAll('h1,h2,h3,h4,p,span,div,label')].find((el) => el.textContent?.trim() === 'Mano de obra' && el.getBoundingClientRect().height > 0);
    let card = title;
    while (card && !card.querySelector('input[type="text"]')) card = card.parentElement;
    return card?.querySelector('input[type="text"]') ?? null;
  });
  const laborInput = labor.asElement();
  if (!laborInput) throw new Error('No se encontró el campo «Mano de obra».');
  await reveal(laborInput);
  await laborInput.click({ count: 3 });
  await page.keyboard.type(LABOR, { delay: 50 });
  await rec.snap('En «Costos y plazo», cargá la mano de obra.', laborInput);
  console.log(`    mano de obra: ${await laborInput.evaluate((el) => el.value)}`);

  await tap(page, await find(page, 'button[type="submit"]', /Revisar reparación/));
  const confirm = await find(page, 'button', /^Confirmar reparación$/);
  await rec.snap('Revisá el resumen y confirmá.', confirm);
  await tap(page, confirm);

  const whatsapp = await find(page, 'button', /^Enviar WhatsApp$/, { timeout: 60_000 });
  const ticket = await page.evaluate(() => document.body.innerText.match(/REP-\d+/)?.[0] ?? null);
  await rec.snap('¡Listo! Imprimí el ticket o envialo por WhatsApp.', whatsapp);
  rec.save({ ticket });
  await page.close();
  return ticket;
}

async function recordApp(browser) {
  const viewport = { width: 390, height: 844 };
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await appSignIn(page);
  await go(page, `${APP}/panel/repairs`);
  // En el celular no se ve el recuadro negro que Chrome pone en el campo activo.
  await page.addStyleTag({ content: '*:focus, *:focus-visible { outline: none !important; }' });
  const rec = recorder('app', page, viewport);

  const create = await find(page, 'button,[role="button"]', /^\W*Nueva$/, { timeout: 60_000 });
  await rec.snap('En Reparaciones, tocá «Nueva».', create);
  await tap(page, create);

  await typeInto(page, await find(page, 'input', /^Buscar cliente$/), 'Demo 05');
  const customer = await find(page, 'button,[role="button"]', new RegExp(`^${CUSTOMER}`));
  await reveal(customer);
  await rec.snap('Buscá al cliente y tocalo para elegirlo.', customer);
  await tap(page, customer);

  const brand = await find(page, 'button,[role="button"]', new RegExp(`^${BRAND}$`));
  await reveal(brand);
  await tap(page, brand);
  const model = await find(page, 'input', /^Modelo$/);
  await typeInto(page, model, MODEL);
  await reveal(model);
  await rec.snap('Elegí la marca y escribí el modelo.', model);

  // El chip empieza con un ícono (un carácter invisible).
  const problem = await find(page, 'button,[role="button"]', /^\W*Pantalla \/ Módulo$/);
  await reveal(problem);
  await tap(page, problem);
  // El chip ya completa «Cambio de Pantalla / Módulo Táctil»: se suma el detalle.
  await typeInto(page, await find(page, 'textarea', /^¿Qué le pasa\?$/), `. ${PROBLEM_NOTE}`);
  await reveal(problem);
  await rec.snap('Marcá el problema y contá qué le pasa.', problem);

  const labor = await find(page, 'input', /^Mano de obra$/);
  await reveal(labor);
  await typeInto(page, labor, LABOR);
  await rec.snap('Si ya sabés el precio, cargá la mano de obra.', labor);

  // El botón de la app no tiene rol de botón: se lo busca por su texto.
  const submitText = await find(page, 'div', /^\W*Crear orden de reparación$/);
  // Se marca el botón entero, no solo el texto.
  const submit = (await submitText.evaluateHandle((el) => {
    let node = el;
    while (node.parentElement && node.getBoundingClientRect().height < 40) node = node.parentElement;
    return node;
  })).asElement();
  await rec.snap('Tocá «Crear orden de reparación».', submit);
  await tap(page, submit);

  await page.waitForFunction(() => /^\/panel\/repairs\/(?!new)[^/]+$/.test(location.pathname), { timeout: 60_000 });
  await wait(3500);
  const ticket = await page.evaluate(() => document.body.innerText.match(/REP-\d+/)?.[0] ?? null);
  await rec.snap('¡Listo! La orden queda creada con su número.', null);
  rec.save({ ticket });
  await page.close();
  return ticket;
}

const only = process.argv[2];
const browser = await openBrowser();
const created = [];
try {
  if (!only || only === 'web') created.push(['web', await recordWeb(browser)]);
  if (!only || only === 'app') created.push(['app', await recordApp(browser)]);
} catch (error) {
  // Para ver dónde se trabó el recorrido.
  for (const [index, page] of (await browser.pages()).entries()) await page.screenshot({ path: join(OUT, `_error-${index}.png`) }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  for (const [kind, ticket] of created) console.log(`Reparación de prueba creada (${kind}): ${ticket ?? 'sin número visible'}`);
}
