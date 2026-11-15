import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  MAX_REPAIR_ACCESS_LENGTH,
  appendPatternDot,
  dotAtGridPoint,
  formatDotsToPattern,
  intermediatePatternDot,
  parsePatternToDots,
  patternSegmentsForGrid,
  pinValidationMeta,
  validateRepairAccess,
} from '../../mobile/src/lib/repair-access';
import { parseCreateRepairInput } from '@/lib/repairs/create-repair-input';

describe('lógica de desbloqueo y patrón en reparaciones móviles', () => {
  it('parsea formatos de patrón de la web y la app móvil respetando el último paréntesis', () => {
    expect(parsePatternToDots('Patrón: 1-2-5-8 (11-12-22-32)')).toEqual([1, 2, 5, 8]);
    expect(parsePatternToDots('Patrón complejo (5 puntos) (11-21-31-32-33)')).toEqual([1, 4, 7, 8, 9]);
    expect(parsePatternToDots('11-12-22-32')).toEqual([1, 2, 5, 8]);
    expect(parsePatternToDots('1-2-5-8')).toEqual([1, 2, 5, 8]);
    expect(parsePatternToDots('1258')).toEqual([1, 2, 5, 8]);
  });

  it('mantiene el formato ida y vuelta de 9 puntos dentro del límite de 100 caracteres', () => {
    const allDots = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const encoded = formatDotsToPattern(allDots);
    expect(encoded).toBe('Patrón: 1-2-3-4-5-6-7-8-9 (11-12-13-21-22-23-31-32-33)');
    expect(encoded.length).toBeLessThanOrEqual(MAX_REPAIR_ACCESS_LENGTH);
    expect(parsePatternToDots(encoded)).toEqual(allDots);
  });

  it('autocompleta puntos colineales intermedios al deslizar y respeta saltos de caballo', () => {
    expect(intermediatePatternDot(1, 3)).toBe(2);
    expect(intermediatePatternDot(1, 9)).toBe(5);
    expect(intermediatePatternDot(3, 7)).toBe(5);
    expect(intermediatePatternDot(1, 7)).toBe(4);
    expect(intermediatePatternDot(1, 6)).toBeNull();

    expect(appendPatternDot([1], 3, true)).toEqual([1, 2, 3]);
    expect(appendPatternDot([2, 5, 4], 6, true)).toEqual([2, 5, 4, 6]);
    expect(appendPatternDot([1], 6, true)).toEqual([1, 6]);
  });

  it('detecta puntos y calcula segmentos geométricos exactos sobre la grilla 3×3', () => {
    expect(dotAtGridPoint(40, 40, 240)).toBe(1);
    expect(dotAtGridPoint(120, 120, 240)).toBe(5);
    expect(dotAtGridPoint(200, 200, 240)).toBe(9);
    expect(dotAtGridPoint(0, 0, 240)).toBeNull();

    const segments = patternSegmentsForGrid([1, 2, 5], 240);
    expect(segments).toHaveLength(2);
    expect(Math.round(segments[0].length)).toBe(80);
    expect(Math.round(segments[0].angleDeg)).toBe(0);
    expect(Math.round(segments[1].length)).toBe(80);
    expect(Math.round(segments[1].angleDeg)).toBe(90);
  });

  it('rechaza patrones de un solo punto (incluido formato generado) y acepta 2 o más puntos', () => {
    expect(validateRepairAccess('pattern', formatDotsToPattern([5]))).toContain('al menos 2 puntos');
    expect(validateRepairAccess('pattern', '5')).toContain('al menos 2 puntos');
    expect(validateRepairAccess('pattern', '22')).toContain('al menos 2 puntos');
    expect(validateRepairAccess('pattern', '---')).toContain('al menos 2 puntos válidos');

    expect(validateRepairAccess('pattern', formatDotsToPattern([1, 2]))).toBeNull();
    expect(validateRepairAccess('pattern', '1-2-5-8')).toBeNull();
    expect(validateRepairAccess('pattern', 'Patrón en L invertida')).toBeNull();
  });

  it('valida PIN con al menos un dígito real y soporte multi-PIN', () => {
    expect(validateRepairAccess('pin', '')).toContain('PIN');
    expect(validateRepairAccess('pin', ', - /')).toContain('al menos un número');
    expect(validateRepairAccess('pin', '12a4')).toContain('Solo'.toLowerCase());
    expect(validateRepairAccess('pin', '1234')).toBeNull();
    expect(validateRepairAccess('pin', '1234, 5678')).toBeNull();

    expect(pinValidationMeta('1234')).toEqual({
      valid: true,
      codeCount: 1,
      digitCount: 4,
      label: '✓ 4 dígitos',
    });
    expect(pinValidationMeta('1234, 5678')).toEqual({
      valid: true,
      codeCount: 2,
      digitCount: 8,
      label: '✓ 2 códigos',
    });
  });

  it('mantiene paridad estricta de longitud máxima (100 caracteres) con el esquema del servidor', () => {
    const exact100 = 'x'.repeat(100);
    const over100 = 'x'.repeat(101);

    for (const type of ['password', 'other'] as const) {
      expect(validateRepairAccess(type, exact100)).toBeNull();
      expect(validateRepairAccess(type, over100)).toContain('100');
    }

    const basePayload = {
      idempotency_key: 'test-key-12345',
      customer_id: '00000000-0000-4000-8000-000000000001',
      device_brand: 'Samsung',
      device_model: 'Galaxy A54',
      device_type: 'smartphone',
      problem_description: 'Pantalla rota',
      access_type: 'other',
    };

    expect(parseCreateRepairInput({ ...basePayload, access_password: exact100 }).success).toBe(true);
    expect(parseCreateRepairInput({ ...basePayload, access_password: over100 }).success).toBe(false);
  });

  it('garantiza que la UI móvil protege gestos táctiles de patrón y no conserva maxLength=200 en acceso', () => {
    const root = path.resolve(__dirname, '../..');
    const pickerSource = fs.readFileSync(path.join(root, 'mobile/src/components/pattern-picker.tsx'), 'utf8');
    const accessFieldSource = fs.readFileSync(path.join(root, 'mobile/src/components/repair-access-field.tsx'), 'utf8');
    const newScreenSource = fs.readFileSync(path.join(root, 'mobile/src/app/panel/repairs/new.tsx'), 'utf8');
    const editorsSource = fs.readFileSync(path.join(root, 'mobile/src/components/repair-editors.tsx'), 'utf8');

    expect(pickerSource).toContain('pointerEvents="none"');
    expect(pickerSource).toContain('onResponderTerminationRequest');
    expect(accessFieldSource).not.toContain('maxLength={200}');
    expect(newScreenSource).toContain('scrollEnabled={!drawingPattern}');
    expect(editorsSource).toContain('scrollEnabled={!drawingPattern}');
  });
});
