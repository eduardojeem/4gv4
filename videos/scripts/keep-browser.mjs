// Deja un Chrome abierto (puerto local 9333) para explorar pantallas paso a paso con step.mjs.
import { openBrowser } from './browser.mjs';

const browser = await openBrowser({ args: ['--remote-debugging-port=9333', '--remote-debugging-address=127.0.0.1'] });
console.log('Chrome listo en 127.0.0.1:9333');
process.on('SIGINT', () => browser.close().then(() => process.exit(0)));
await new Promise(() => {});
