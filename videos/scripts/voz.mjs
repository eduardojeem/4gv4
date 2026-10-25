/**
 * Genera la locución con Azure Speech, una frase por escena, a partir de
 * src/locucion.json. Deja los audios en public/voz/ y sus duraciones en
 * src/voz.json, que el video usa para que cada escena dure lo que su frase.
 *
 * Necesita videos/.env.local (no se sube al repositorio) con:
 *   AZURE_SPEECH_KEY=...
 *   AZURE_SPEECH_REGION=eastus   (la región del recurso de Azure)
 *
 *   npm run voz            genera solo las frases que cambiaron
 *   npm run voz -- --todo  las vuelve a generar todas
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SCRIPT_FILE = join(ROOT, 'src', 'locucion.json');
const RESULT_FILE = join(ROOT, 'src', 'voz.json');
const AUDIO_DIR = join(ROOT, 'public', 'voz');

function localEnv() {
  const file = join(ROOT, '.env.local');
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')]),
  );
}

const escapeXml = (text) => text.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]);

/** Duración de un WAV PCM: tamaño del bloque de datos / bytes por segundo. */
function wavSeconds(buffer) {
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ') byteRate = buffer.readUInt32LE(offset + 16);
    if (id === 'data' && byteRate) return Math.min(size, buffer.length - offset - 8) / byteRate;
    offset += 8 + size + (size % 2);
  }
  throw new Error('El audio que devolvió Azure no es un WAV válido.');
}

const env = { ...localEnv(), ...process.env };
const key = env.AZURE_SPEECH_KEY?.trim();
const region = env.AZURE_SPEECH_REGION?.trim();
if (!key || !region) {
  console.error('Falta la clave de Azure. Creá videos/.env.local con AZURE_SPEECH_KEY y AZURE_SPEECH_REGION.');
  process.exit(1);
}
if (!/^[a-z0-9]+$/.test(region)) {
  console.error('AZURE_SPEECH_REGION debe ser el nombre de la región, por ejemplo eastus o brazilsouth.');
  process.exit(1);
}

const script = JSON.parse(readFileSync(SCRIPT_FILE, 'utf8'));
const previous = existsSync(RESULT_FILE) ? JSON.parse(readFileSync(RESULT_FILE, 'utf8')) : { lines: {} };
const regenerateAll = process.argv.includes('--todo');
mkdirSync(AUDIO_DIR, { recursive: true });

const result = { voice: script.voice, lines: {} };
for (const [id, text] of Object.entries(script.lines)) {
  // Si no cambió el texto, la voz ni la velocidad, se reutiliza el audio ya generado.
  const hash = createHash('sha1').update(`${script.voice}|${script.rate}|${text}`).digest('hex').slice(0, 12);
  const file = `voz/${id}.wav`;
  const old = previous.lines?.[id];
  if (!regenerateAll && old?.hash === hash && existsSync(join(ROOT, 'public', file))) {
    result.lines[id] = old;
    console.log(`= ${id} (sin cambios)`);
    continue;
  }

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-PY"><voice name="${escapeXml(script.voice)}"><prosody rate="${escapeXml(script.rate ?? '+0%')}">${escapeXml(text)}</prosody></voice></speak>`;
  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-48khz-16bit-mono-pcm',
      'User-Agent': 'mitiendapy-videos',
    },
    body: ssml,
  });
  if (!response.ok) {
    const hint = response.status === 401 ? ' (revisá la clave y la región)' : '';
    console.error(`✗ ${id}: Azure respondió ${response.status}${hint}.`);
    process.exit(1);
  }
  const audio = Buffer.from(await response.arrayBuffer());
  writeFileSync(join(ROOT, 'public', file), audio);
  const seconds = Math.round(wavSeconds(audio) * 100) / 100;
  result.lines[id] = { file, seconds, hash };
  console.log(`✓ ${id}: ${seconds}s`);
}

writeFileSync(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`);
console.log('Listo: ahora `npm run render` exporta el video con voz.');
