import { Composition } from 'remotion';

import { Promo, PROMO_DURATION } from './Promo';
import { Tutorial, tutorialDuration } from './Tutorial';

/** Cada Composition es un video que se puede ver en el estudio y exportar. */
export const RemotionRoot = () => (
  <>
    {/* Vertical 9:16: Reels, TikTok y estados de WhatsApp. */}
    <Composition id="Promo" component={Promo} durationInFrames={PROMO_DURATION} fps={30} width={1080} height={1920} />
    {/* Tutorial «Cómo crear una nueva reparación»: web horizontal (YouTube, ayuda) y app vertical. */}
    <Composition id="ReparacionWeb" component={Tutorial} defaultProps={{ kind: 'web' as const }} durationInFrames={tutorialDuration('web')} fps={30} width={1920} height={1080} />
    <Composition id="ReparacionApp" component={Tutorial} defaultProps={{ kind: 'app' as const }} durationInFrames={tutorialDuration('app')} fps={30} width={1080} height={1920} />
  </>
);
