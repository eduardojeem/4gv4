export type AccessType = 'none' | 'pin' | 'pattern' | 'password' | 'biometric' | 'other';

export const MAX_REPAIR_ACCESS_LENGTH = 100;

export type PatternSegment = {
  key: string;
  midX: number;
  midY: number;
  length: number;
  angleDeg: number;
};

/**
 * Parsea cadenas de patrón en los dos formatos compatibles con web/móvil:
 * - Coordenadas RowCol en el último paréntesis: "Patrón: 1-2-5-8 (11-12-22-32)" o "Diagonal (11-22-33)"
 * - Lista RowCol sin paréntesis: "11-12-22-32"
 * - Secuencia simple de dígitos 1..9: "1-2-5-8" o "1258"
 */
export function parsePatternToDots(value?: string | null): number[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  // 1. Formato con coordenadas "(11-12-22-32)" usando el último paréntesis.
  const parenMatches = Array.from(trimmed.matchAll(/\(([^)]+)\)/g));
  const lastParen = parenMatches.length > 0 ? parenMatches[parenMatches.length - 1][1] : null;
  if (lastParen) {
    const codes = lastParen.split(/[-\s,]+/).filter(Boolean);
    const dots: number[] = [];
    for (const code of codes) {
      if (code.length === 2) {
        const r = Number.parseInt(code[0], 10);
        const c = Number.parseInt(code[1], 10);
        if (r >= 1 && r <= 3 && c >= 1 && c <= 3) {
          const dotNumber = (r - 1) * 3 + c;
          if (!dots.includes(dotNumber)) dots.push(dotNumber);
        }
      }
    }
    if (dots.length > 0) return dots;
  }

  // 2. Coordenadas RowCol sin paréntesis (p. ej. "11-12-22-32" o "11 22").
  const numericTokens = trimmed.match(/\d+/g);
  if (
    numericTokens &&
    numericTokens.length >= 1 &&
    numericTokens.every((token) => /^[1-3]{2}$/.test(token)) &&
    (numericTokens.length >= 2 || trimmed.includes('-'))
  ) {
    const dots: number[] = [];
    for (const token of numericTokens) {
      const r = Number.parseInt(token[0], 10);
      const c = Number.parseInt(token[1], 10);
      const dotNumber = (r - 1) * 3 + c;
      if (!dots.includes(dotNumber)) dots.push(dotNumber);
    }
    if (dots.length > 0) return dots;
  }

  // 3. Secuencia numérica simple 1..9: "1-2-5-8" o "1258".
  const digits = trimmed.replace(/[^1-9]/g, '');
  if (digits.length > 0) {
    const uniqueDots: number[] = [];
    for (const ch of digits) {
      const d = Number.parseInt(ch, 10);
      if (!uniqueDots.includes(d)) uniqueDots.push(d);
    }
    return uniqueDots;
  }

  return [];
}

/** Convierte una lista de puntos 1..9 al formato compartido web/móvil. */
export function formatDotsToPattern(dots: number[]): string {
  const valid: number[] = [];
  for (const dot of dots) {
    if (Number.isInteger(dot) && dot >= 1 && dot <= 9 && !valid.includes(dot)) {
      valid.push(dot);
    }
  }
  if (valid.length === 0) return '';
  const seq = valid.join('-');
  const coords = valid
    .map((dot) => {
      const r = Math.floor((dot - 1) / 3) + 1;
      const c = ((dot - 1) % 3) + 1;
      return `${r}${c}`;
    })
    .join('-');
  return `Patrón: ${seq} (${coords})`;
}

/** Centro geométrico (x, y) de un punto 1..9 dentro de una grilla cuadrada. */
export function dotCenter(dotNumber: number, gridSize: number): { x: number; y: number } {
  const cell = gridSize / 3;
  const row = Math.floor((dotNumber - 1) / 3);
  const col = (dotNumber - 1) % 3;
  return {
    x: col * cell + cell / 2,
    y: row * cell + cell / 2,
  };
}

/** Devuelve el punto (1..9) cuyo centro está dentro del radio táctil, o null. */
export function dotAtGridPoint(
  x: number,
  y: number,
  gridSize: number,
  hitRadiusFactor = 0.43,
): number | null {
  if (gridSize <= 0) return null;
  const cell = gridSize / 3;
  const maxDist = cell * hitRadiusFactor;
  if (x < -maxDist * 0.35 || x > gridSize + maxDist * 0.35 || y < -maxDist * 0.35 || y > gridSize + maxDist * 0.35) {
    return null;
  }
  let bestDot: number | null = null;
  let bestDist = Infinity;
  for (let dot = 1; dot <= 9; dot++) {
    const center = dotCenter(dot, gridSize);
    const dist = Math.hypot(x - center.x, y - center.y);
    if (dist <= maxDist && dist < bestDist) {
      bestDist = dist;
      bestDot = dot;
    }
  }
  return bestDot;
}

/**
 * Si dos puntos de la grilla 3×3 tienen exactamente un punto colineal en el medio
 * (ej. 1→3 pasa por 2, 1→9 pasa por 5) y aún no fue visitado, lo devuelve.
 */
export function intermediatePatternDot(fromDot: number, toDot: number): number | null {
  if (fromDot === toDot || fromDot < 1 || fromDot > 9 || toDot < 1 || toDot > 9) return null;
  const r1 = Math.floor((fromDot - 1) / 3);
  const c1 = (fromDot - 1) % 3;
  const r2 = Math.floor((toDot - 1) / 3);
  const c2 = (toDot - 1) % 3;
  if ((r1 + r2) % 2 !== 0 || (c1 + c2) % 2 !== 0) return null;
  const midRow = (r1 + r2) / 2;
  const midCol = (c1 + c2) / 2;
  return midRow * 3 + midCol + 1;
}

/** Agrega un punto a la secuencia (autocompletando punto intermedio colineal si corresponde). */
export function appendPatternDot(
  currentDots: readonly number[],
  nextDot: number,
  includeCollinear = true,
): number[] {
  if (!Number.isInteger(nextDot) || nextDot < 1 || nextDot > 9) return [...currentDots];
  if (currentDots.includes(nextDot)) return [...currentDots];

  const next = [...currentDots];
  if (includeCollinear && next.length > 0) {
    const prevDot = next[next.length - 1];
    const mid = intermediatePatternDot(prevDot, nextDot);
    if (mid !== null && !next.includes(mid)) {
      next.push(mid);
    }
  }
  next.push(nextDot);
  return next;
}

/** Calcula líneas de conexión entre puntos consecutivos para renderizar con Views rotadas. */
export function patternSegmentsForGrid(dots: readonly number[], gridSize: number): PatternSegment[] {
  if (dots.length < 2 || gridSize <= 0) return [];
  const segments: PatternSegment[] = [];
  for (let i = 0; i < dots.length - 1; i++) {
    const a = dotCenter(dots[i], gridSize);
    const b = dotCenter(dots[i + 1], gridSize);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0) continue;
    segments.push({
      key: `${dots[i]}-${dots[i + 1]}`,
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
      length,
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    });
  }
  return segments;
}

/** Resumen amigable del PIN ingresado para indicadores visuales de longitud y formato. */
export function pinValidationMeta(value?: string | null): {
  valid: boolean;
  codeCount: number;
  digitCount: number;
  label: string;
} {
  const pwd = (value || '').trim();
  const digits = pwd.replace(/\D/g, '');
  if (!pwd) {
    return { valid: false, codeCount: 0, digitCount: 0, label: 'Sin ingresar' };
  }
  if (!/\d/.test(pwd)) {
    return { valid: false, codeCount: 0, digitCount: 0, label: 'Ingresá números' };
  }
  if (!/^[\d\s,/-]+$/.test(pwd)) {
    return { valid: false, codeCount: 0, digitCount: digits.length, label: 'Solo números y comas' };
  }
  if (pwd.length > MAX_REPAIR_ACCESS_LENGTH) {
    return { valid: false, codeCount: 0, digitCount: digits.length, label: `Máximo ${MAX_REPAIR_ACCESS_LENGTH} caracteres` };
  }
  const codes = pwd.split(/[,/]+/).map((part) => part.replace(/\D/g, '')).filter(Boolean);
  const codeCount = codes.length;
  const label =
    codeCount > 1
      ? `✓ ${codeCount} códigos`
      : `✓ ${digits.length} ${digits.length === 1 ? 'dígito' : 'dígitos'}`;
  return { valid: true, codeCount, digitCount: digits.length, label };
}

/**
 * Validaciones de acceso alineadas con el servidor (`create-repair-input.ts`) y la web (`repair.schema.ts`):
 * máximo 100 caracteres en todos los tipos, al menos 1 dígito real en PIN, y mínimo 2 puntos en patrones.
 */
export function validateRepairAccess(accessType: AccessType, password?: string | null): string | null {
  const type = accessType || 'none';
  const pwd = (password || '').trim();

  if (type === 'none' || type === 'biometric') {
    return null;
  }

  if (type === 'pin') {
    if (!pwd) {
      return 'Ingresá el PIN del dispositivo (o cambiá el tipo de acceso).';
    }
    if (!/\d/.test(pwd)) {
      return 'El PIN debe incluir al menos un número.';
    }
    if (!/^[\d\s,/-]+$/.test(pwd)) {
      return 'El PIN solo puede contener números (separá varios con comas).';
    }
    if (pwd.length > MAX_REPAIR_ACCESS_LENGTH) {
      return `El PIN es demasiado largo (máximo ${MAX_REPAIR_ACCESS_LENGTH} caracteres).`;
    }
    return null;
  }

  if (type === 'password') {
    if (!pwd) {
      return 'Ingresá la contraseña del dispositivo (o cambiá el tipo de acceso).';
    }
    if (pwd.length > MAX_REPAIR_ACCESS_LENGTH) {
      return `La contraseña es demasiado larga (máximo ${MAX_REPAIR_ACCESS_LENGTH} caracteres).`;
    }
    return null;
  }

  if (type === 'pattern') {
    if (!pwd) {
      return 'Dibujá el patrón de desbloqueo (o cambiá el tipo de acceso).';
    }
    if (pwd.length > MAX_REPAIR_ACCESS_LENGTH) {
      return `El patrón es demasiado largo (máximo ${MAX_REPAIR_ACCESS_LENGTH} caracteres).`;
    }
    const dots = parsePatternToDots(pwd);
    if (dots.length === 1) {
      return 'El patrón debe conectar al menos 2 puntos.';
    }
    // Si escribió solo símbolos o números fuera de rango sin una descripción textual clara, rechazar.
    if (dots.length === 0 && !/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(pwd)) {
      return 'El patrón debe conectar al menos 2 puntos válidos (del 1 al 9).';
    }
    return null;
  }

  if (type === 'other') {
    if (!pwd) {
      return 'Describí el método de desbloqueo o acceso al equipo.';
    }
    if (pwd.length > MAX_REPAIR_ACCESS_LENGTH) {
      return `La descripción es demasiado larga (máximo ${MAX_REPAIR_ACCESS_LENGTH} caracteres).`;
    }
    return null;
  }

  return null;
}
