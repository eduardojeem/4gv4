import { describe, expect, it } from 'vitest';
import { repairWarrantySummary } from '../../mobile/src/lib/repair-warranty';

describe('garantía en el detalle móvil', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  it('no presenta duración ausente como garantía cero', () => {
    expect(repairWarrantySummary({}, now).duration).toBe('No especificada');
    expect(repairWarrantySummary({ warranty_months: 0 }, now).status).toBe('Sin garantía');
  });
  it('no inicia la garantía antes de entregar', () => {
    expect(repairWarrantySummary({ warranty_months: 3, warranty_expires_at: '2026-12-01T12:00:00Z' }, now).status).toBe('Pendiente de entrega');
  });
  it('muestra la cobertura y las condiciones guardadas', () => {
    const result = repairWarrantySummary({ warranty_months: 3, warranty_type: 'parts', warranty_notes: 'Solo pantalla' }, now);
    expect(result.coverage).toBe('Solo repuestos');
    expect(result.notes).toBe('Solo pantalla');
  });
  it('distingue garantía vigente y vencida usando la fecha real', () => {
    expect(repairWarrantySummary({ warranty_months: 3, delivered_at: '2026-10-01', warranty_expires_at: '2027-01-01T12:00:00Z' }, now).status).toBe('Vigente');
    expect(repairWarrantySummary({ warranty_months: 3, delivered_at: '2026-01-01', warranty_expires_at: '2026-04-01T12:00:00Z' }, now).status).toBe('Vencida');
  });
  it('no inventa una fecha de vencimiento si falta o es inválida', () => {
    expect(repairWarrantySummary({ warranty_months: 3, delivered_at: '2026-10-01', warranty_expires_at: 'invalid' }, now).status).toBe('Vencimiento sin registrar');
  });
});