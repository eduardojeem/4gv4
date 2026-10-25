import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import app from '../public/tutorial/app.json';
import web from '../public/tutorial/web.json';
import { BRAND_BACKGROUND, CYAN, DARK, FONT, LOGO_DARK_BG } from './brand';

/**
 * Tutorial «Cómo crear una nueva reparación», paso a paso, con las capturas
 * que graba `npm run tutorial:capturas` en DEV (datos de prueba).
 * Web: horizontal, con la pantalla en una ventana. App: vertical, en un teléfono.
 */

type Box = { x: number; y: number; width: number; height: number };
type Step = { image: string; caption: string; target: Box | null };
type Recording = { viewport: { width: number; height: number }; steps: Step[] };
type Kind = 'web' | 'app';

const RECORDINGS: Record<Kind, Recording> = { web, app };
const INTRO = 75;
const STEP = 120;
const LAST_STEP = 150;
const OUTRO = 90;
const FADE = 10;

export const tutorialDuration = (kind: Kind) => INTRO + (RECORDINGS[kind].steps.length - 1) * STEP + LAST_STEP + OUTRO;

function useEnter(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return { opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [40, 0])}px)` };
}

function Intro({ kind }: { kind: Kind }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14 } });
  const title = useEnter(14);
  const badge = useEnter(26);
  const vertical = kind === 'app';
  return (
    <AbsoluteFill style={{ background: BRAND_BACKGROUND, alignItems: 'center', justifyContent: 'center', gap: vertical ? 70 : 50, padding: 80 }}>
      <Img src={LOGO_DARK_BG} style={{ width: vertical ? 760 : 620, opacity: pop, transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})` }} />
      <div style={{ ...title, fontFamily: FONT, fontSize: vertical ? 80 : 72, fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.1 }}>
        Cómo crear una
        {vertical ? <br /> : ' '}
        nueva reparación
      </div>
      <div style={{ ...badge, padding: '14px 34px', borderRadius: 999, border: '2px solid rgba(125,211,252,0.6)', color: '#E0F2FE', fontFamily: FONT, fontSize: vertical ? 40 : 34, fontWeight: 700 }}>
        {vertical ? 'Desde la app en tu celular' : 'Desde el panel web'}
      </div>
    </AbsoluteFill>
  );
}

function Outro({ kind }: { kind: Kind }) {
  const title = useEnter(0);
  const site = useEnter(14);
  const vertical = kind === 'app';
  return (
    <AbsoluteFill style={{ background: BRAND_BACKGROUND, alignItems: 'center', justifyContent: 'center', gap: 50, padding: 80 }}>
      <div style={{ ...title, fontFamily: FONT, fontSize: vertical ? 96 : 84, fontWeight: 900, color: '#FFFFFF' }}>¡Así de fácil!</div>
      <div style={{ ...title, fontFamily: FONT, fontSize: vertical ? 42 : 38, fontWeight: 600, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
        Tu taller ordenado, con cada equipo a la vista.
      </div>
      <Img src={LOGO_DARK_BG} style={{ ...site, width: vertical ? 620 : 520, marginTop: 20 }} />
    </AbsoluteFill>
  );
}

/**
 * La captura con un acercamiento lento hacia donde se toca, un anillo que late
 * sobre ese lugar y un «toque» a mitad del paso.
 */
function Shot({ step, recording, width, duration, maxZoom }: { step: Step; recording: Recording; width: number; duration: number; maxZoom: number }) {
  const frame = useCurrentFrame();
  const scale = width / recording.viewport.width;
  const height = recording.viewport.height * scale;
  const target = step.target && {
    x: step.target.x * scale,
    y: step.target.y * scale,
    width: step.target.width * scale,
    height: step.target.height * scale,
  };
  // Con elementos anchos se acerca menos, para que el anillo entre completo.
  const fittingZoom = target ? Math.max(1, Math.min(maxZoom, (width - 16) / (target.width + 24))) : 1;
  const zoom = interpolate(frame, [10, duration - 20], [1, fittingZoom], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const origin = target ? `${target.x + target.width / 2}px ${target.y + target.height / 2}px` : 'center';
  const ring = interpolate(frame, [12, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulse = 1 + Math.sin(frame / 5) * 0.015;
  const tapAt = Math.round(duration * 0.55);
  const tap = interpolate(frame, [tapAt, tapAt + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pad = 10;
  // El anillo no sale de la pantalla: con elementos de ancho completo se verían solo dos líneas.
  const ringBox = target && (() => {
    const left = Math.max(6, target.x - pad);
    const top = Math.max(6, target.y - pad);
    return { left, top, width: Math.min(width - 6, target.x + target.width + pad) - left, height: Math.min(height - 6, target.y + target.height + pad) - top };
  })();
  return (
    <div style={{ width, height, overflow: 'hidden', position: 'relative', background: '#FFFFFF' }}>
      <div style={{ width, height, transform: `scale(${zoom})`, transformOrigin: origin, position: 'relative' }}>
        <Img src={staticFile(step.image)} style={{ width, height, display: 'block' }} />
        {target ? (
          <>
            <div
              style={{
                position: 'absolute',
                ...ringBox,
                borderRadius: 16,
                border: `4px solid ${CYAN}`,
                boxShadow: `0 0 0 6px rgba(34,211,238,0.25), 0 0 30px rgba(34,211,238,0.6)`,
                opacity: ring,
                transform: `scale(${pulse})`,
                transformOrigin: 'center',
              }}
            />
            {/* El toque: un punto que se encoge y una onda que se abre. */}
            <div
              style={{
                position: 'absolute',
                left: target.x + target.width / 2 - 30,
                top: target.y + target.height / 2 - 30,
                width: 60,
                height: 60,
                borderRadius: 30,
                border: `4px solid ${CYAN}`,
                opacity: tap > 0 ? 1 - tap : 0,
                transform: `scale(${0.4 + tap * 1.6})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: target.x + target.width / 2 - 14,
                top: target.y + target.height / 2 - 14,
                width: 28,
                height: 28,
                borderRadius: 14,
                background: 'rgba(34,211,238,0.85)',
                boxShadow: '0 0 14px rgba(34,211,238,0.9)',
                opacity: interpolate(frame, [tapAt - 8, tapAt, tapAt + 16], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function StepNumber({ index, total, size }: { index: number; total: number; size: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: `${size * 0.25}px ${size * 0.6}px`, borderRadius: 999, background: CYAN, color: DARK, fontFamily: FONT, fontSize: size, fontWeight: 900 }}>
      Paso {index + 1} de {total}
    </div>
  );
}

function WebStep({ step, index, total, duration }: { step: Step; index: number; total: number; duration: number }) {
  const frame = useCurrentFrame();
  const enter = useEnter(4);
  const fade = interpolate(frame, [0, FADE, duration - FADE, duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const width = 1500;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, #E2E8F0, #F8FAFC)`, alignItems: 'center', paddingTop: 36, opacity: fade }}>
      <div style={{ borderRadius: 22, overflow: 'hidden', boxShadow: '0 30px 80px rgba(15,23,42,0.30)', border: '2px solid #CBD5E1' }}>
        <div style={{ height: 40, background: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px' }}>
          {['#EF4444', '#F59E0B', '#22C55E'].map((color) => <div key={color} style={{ width: 13, height: 13, borderRadius: 7, background: color }} />)}
          <div style={{ marginLeft: 14, height: 26, flex: 1, borderRadius: 13, background: '#FFFFFF', fontFamily: FONT, fontSize: 16, color: '#64748B', display: 'flex', alignItems: 'center', paddingLeft: 14 }}>
            mitiendapy.com/dashboard/repairs
          </div>
        </div>
        <Shot step={step} recording={RECORDINGS.web} width={width} duration={duration} maxZoom={step.target ? 1.35 : 1} />
      </div>
      {/* Leyenda del paso, sobre la parte de abajo de la pantalla. */}
      <div style={{ ...enter, position: 'absolute', bottom: 46, display: 'flex', alignItems: 'center', gap: 24, padding: '20px 34px', borderRadius: 26, background: 'rgba(11,18,32,0.92)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', maxWidth: 1560 }}>
        <StepNumber index={index} total={total} size={28} />
        <div style={{ fontFamily: FONT, fontSize: 42, fontWeight: 800, color: '#FFFFFF' }}>{step.caption}</div>
      </div>
    </AbsoluteFill>
  );
}

function AppStep({ step, index, total, duration }: { step: Step; index: number; total: number; duration: number }) {
  const frame = useCurrentFrame();
  const enter = useEnter(4);
  const fade = interpolate(frame, [0, FADE, duration - FADE, duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const phoneWidth = 640;
  const screenWidth = phoneWidth - 36;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #F8FAFC, #DBEAFE)`, alignItems: 'center', paddingTop: 90, gap: 50, opacity: fade }}>
      <div style={{ ...enter, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '0 70px', minHeight: 250 }}>
        <StepNumber index={index} total={total} size={34} />
        <div style={{ fontFamily: FONT, fontSize: 58, fontWeight: 900, color: DARK, textAlign: 'center', lineHeight: 1.15 }}>{step.caption}</div>
      </div>
      <div style={{ width: phoneWidth, borderRadius: 86, background: DARK, padding: 18, boxShadow: '0 40px 90px rgba(15,23,42,0.35)' }}>
        <div style={{ borderRadius: 70, overflow: 'hidden' }}>
          <Shot step={step} recording={RECORDINGS.app} width={screenWidth} duration={duration} maxZoom={step.target ? 1.18 : 1} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

export const Tutorial = ({ kind }: { kind: Kind }) => {
  const { steps } = RECORDINGS[kind];
  const StepView = kind === 'web' ? WebStep : AppStep;
  let from = INTRO;
  return (
    <AbsoluteFill style={{ background: '#FFFFFF' }}>
      <Sequence durationInFrames={INTRO}>
        <Intro kind={kind} />
      </Sequence>
      {steps.map((step, index) => {
        const duration = index === steps.length - 1 ? LAST_STEP : STEP;
        const start = from;
        from += duration;
        return (
          <Sequence key={step.image} from={start} durationInFrames={duration}>
            <StepView step={step} index={index} total={steps.length} duration={duration} />
          </Sequence>
        );
      })}
      <Sequence from={from} durationInFrames={OUTRO}>
        <Outro kind={kind} />
      </Sequence>
    </AbsoluteFill>
  );
};
