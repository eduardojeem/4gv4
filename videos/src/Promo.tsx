import { AbsoluteFill, Audio, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import { BLUE, BRAND_BACKGROUND, DARK, FONT, LOGO_DARK_BG } from './brand';
import voice from './voz.json';

/**
 * Promo vertical con capturas reales del sitio oficial (solo páginas públicas).
 * Las capturas se regeneran con `npm run capturas` y quedan en public/capturas/.
 */


const FPS = 30;
// Duraciones mínimas; con locución, cada parte dura lo que su frase.
const INTRO = 75;
const SCENE = 84;
const OUTRO = 90;
/** La voz entra apenas después de que aparece la escena, y deja un respiro al final. */
const VOICE_DELAY = 8;
const VOICE_PAUSE = 14;

type Scene = { id: string; title: string; text: string; badge: string; color: string; image: string; device: 'phone' | 'browser'; url?: string };

const SCENES: Scene[] = [
  { id: 'marketplace', title: 'Todo en un solo lugar', text: 'Productos de comercios de Paraguay, desde el celular.', badge: 'Marketplace', color: BLUE, image: 'oficial-inicio-movil.png', device: 'phone' },
  { id: 'ofertas', title: 'Tus ofertas, a la vista', text: 'Precios en guaraníes y descuentos destacados.', badge: 'Ofertas', color: '#E11D48', image: 'oficial-ofertas.png', device: 'browser', url: 'mitiendapy.com/marketplace' },
  { id: 'producto', title: 'Fichas completas', text: 'Fotos, precio y consulta directa por WhatsApp.', badge: 'Producto', color: '#10B981', image: 'oficial-producto-movil.png', device: 'phone' },
  { id: 'empresas', title: 'Tu comercio, visible', text: 'Aparecé en el directorio de empresas verificadas.', badge: 'Empresas', color: '#0EA5E9', image: 'oficial-empresas.png', device: 'browser', url: 'mitiendapy.com/marketplace/empresas' },
  { id: 'tienda', title: 'Tu tienda web propia', text: 'Una página para tu comercio, lista para compartir.', badge: 'Web', color: '#EC4899', image: 'oficial-tienda.png', device: 'browser', url: 'mitiendapy.com/tecno-store' },
  { id: 'sistema', title: 'Todo tu negocio conectado', text: 'Ventas, productos, clientes y turnos en un mismo lugar.', badge: 'Sistema', color: '#7C3AED', image: 'oficial-sistema-movil.png', device: 'phone' },
  { id: 'stock', title: 'Vendé y tené tu stock al día', text: 'Caja, ventas e inventario con variantes y sucursales.', badge: 'POS y stock', color: '#F59E0B', image: 'oficial-soluciones.png', device: 'browser', url: 'mitiendapy.com/saas/soluciones' },
  { id: 'planes', title: 'Un plan para cada negocio', text: 'Empezá gratis y crecé cuando lo necesites.', badge: 'Planes', color: '#14B8A6', image: 'oficial-planes.png', device: 'browser', url: 'mitiendapy.com/saas/planes' },
];

type VoiceLine = { file: string; seconds: number };
const voiceLines: Partial<Record<string, VoiceLine>> = voice.lines;

/** Cada parte del video, con la frase de la locución que le toca (si ya se generó). */
const TIMELINE = (() => {
  const parts = [
    { id: 'intro', minimum: INTRO },
    ...SCENES.map((scene) => ({ id: scene.id, minimum: SCENE })),
    { id: 'cierre', minimum: OUTRO },
  ];
  let from = 0;
  return parts.map(({ id, minimum }) => {
    const line = voiceLines[id];
    const duration = Math.max(minimum, line ? VOICE_DELAY + Math.ceil(line.seconds * FPS) + VOICE_PAUSE : 0);
    const part = { id, from, duration, line };
    from += duration;
    return part;
  });
})();

export const PROMO_DURATION = TIMELINE.reduce((total, part) => total + part.duration, 0);

/** Entra subiendo y aparece. */
function useEnter(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return { opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [60, 0])}px)` };
}

function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14 } });
  const glow = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: 'clamp' });
  const tagline = useEnter(20);
  const pills = useEnter(32);
  return (
    <AbsoluteFill style={{ background: BRAND_BACKGROUND, alignItems: 'center', justifyContent: 'center', gap: 70, padding: 80 }}>
      <Img
        src={LOGO_DARK_BG}
        style={{ width: 860, transform: `scale(${interpolate(pop, [0, 1], [0.7, 1])})`, opacity: pop, filter: `drop-shadow(0 0 ${40 * glow}px rgba(56,189,248,0.55))` }}
      />
      <div style={{ ...tagline, textAlign: 'center' }}>
        <div style={{ fontFamily: FONT, fontSize: 64, fontWeight: 800, color: '#FFFFFF' }}>Tu comercio, desde el celular</div>
      </div>
      <div style={{ ...pills, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, maxWidth: 900 }}>
        {['Marketplace', 'Tienda web', 'Punto de venta', 'Stock'].map((label) => (
          <div key={label} style={{ padding: '14px 30px', borderRadius: 999, border: '2px solid rgba(125,211,252,0.6)', color: '#E0F2FE', fontFamily: FONT, fontSize: 34, fontWeight: 700 }}>{label}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** Teléfono con la captura real adentro (1170×2532, como un iPhone). */
function Phone({ image, zoom }: { image: string; zoom: number }) {
  const width = 560;
  const screenWidth = width - 36;
  return (
    <div style={{ width, borderRadius: 78, background: DARK, padding: 18, boxShadow: '0 40px 90px rgba(15,23,42,0.35)' }}>
      <div style={{ width: screenWidth, height: (screenWidth * 2532) / 1170, borderRadius: 62, overflow: 'hidden', background: '#FFFFFF' }}>
        <Img src={staticFile(`capturas/${image}`)} style={{ width: '100%', transform: `scale(${zoom})`, transformOrigin: 'top center' }} />
      </div>
    </div>
  );
}

/** Ventana de navegador con la captura de la web (2880×1800). */
function Browser({ image, zoom, url }: { image: string; zoom: number; url: string }) {
  const width = 1000;
  return (
    <div style={{ width, borderRadius: 28, overflow: 'hidden', background: '#FFFFFF', boxShadow: '0 40px 90px rgba(15,23,42,0.35)', border: '2px solid #E2E8F0' }}>
      <div style={{ height: 56, background: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px' }}>
        {['#EF4444', '#F59E0B', '#22C55E'].map((color) => <div key={color} style={{ width: 16, height: 16, borderRadius: 8, background: color }} />)}
        <div style={{ flex: 1, marginLeft: 16, height: 32, borderRadius: 16, background: '#FFFFFF', fontFamily: FONT, fontSize: 20, color: '#64748B', display: 'flex', alignItems: 'center', paddingLeft: 18 }}>{url}</div>
      </div>
      <div style={{ width, height: (width * 1800) / 2880, overflow: 'hidden' }}>
        <Img src={staticFile(`capturas/${image}`)} style={{ width: '100%', transform: `scale(${zoom})`, transformOrigin: 'top left' }} />
      </div>
    </div>
  );
}

function SceneView({ scene, duration }: { scene: Scene; duration: number }) {
  const frame = useCurrentFrame();
  const device = useEnter(2);
  const copy = useEnter(10);
  const fadeOut = interpolate(frame, [duration - 10, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Acercamiento lento, para que la captura no quede quieta.
  const zoom = interpolate(frame, [0, duration], [1, 1.06]);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #F8FAFC, ${scene.color}1F)`, alignItems: 'center', justifyContent: 'center', padding: 70, opacity: fadeOut }}>
      <div style={{ ...copy, textAlign: 'center', marginBottom: 56 }}>
        <div style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 999, background: scene.color, color: '#FFFFFF', fontFamily: FONT, fontSize: 32, fontWeight: 800, marginBottom: 22 }}>{scene.badge}</div>
        <div style={{ fontFamily: FONT, fontSize: 72, fontWeight: 900, color: DARK, lineHeight: 1.1 }}>{scene.title}</div>
        <div style={{ fontFamily: FONT, fontSize: 38, fontWeight: 500, color: '#475569', marginTop: 16, lineHeight: 1.3 }}>{scene.text}</div>
      </div>
      <div style={device}>
        {scene.device === 'phone' ? <Phone image={scene.image} zoom={zoom} /> : <Browser image={scene.image} zoom={zoom} url={scene.url ?? 'mitiendapy.com'} />}
      </div>
    </AbsoluteFill>
  );
}

function Outro() {
  const title = useEnter(0);
  const button = useEnter(15);
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill style={{ background: BRAND_BACKGROUND, alignItems: 'center', justifyContent: 'center', gap: 60, padding: 90 }}>
      <Img src={LOGO_DARK_BG} style={{ ...title, width: 640 }} />
      <div style={{ ...title, textAlign: 'center' }}>
        <div style={{ fontFamily: FONT, fontSize: 92, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1 }}>Empezá hoy</div>
        <div style={{ fontFamily: FONT, fontSize: 46, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 20 }}>Creá tu comercio en minutos</div>
      </div>
      <div style={{ ...button, transform: `${button.transform} scale(${pulse})`, padding: '34px 70px', borderRadius: 999, background: '#FFFFFF', fontFamily: FONT, fontSize: 52, fontWeight: 900, color: BLUE }}>
        mitiendapy.com
      </div>
    </AbsoluteFill>
  );
}

export const Promo = () => (
  <AbsoluteFill style={{ background: '#FFFFFF' }}>
    {TIMELINE.map((part) => {
      const scene = SCENES.find((item) => item.id === part.id);
      return (
        <Sequence key={part.id} from={part.from} durationInFrames={part.duration}>
          {part.id === 'intro' ? <Intro /> : part.id === 'cierre' ? <Outro /> : scene ? <SceneView scene={scene} duration={part.duration} /> : null}
          {part.line ? (
            <Sequence from={VOICE_DELAY}>
              <Audio src={staticFile(part.line.file)} />
            </Sequence>
          ) : null}
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
