import { describe, expect, it } from 'vitest';
import {
  branchDraft,
  branchPayload,
  branchDraftIssue,
} from '../../mobile/src/lib/branch-model';
describe('edición móvil de sucursales', () => {
  it('envía texto vacío explícito para borrar datos existentes', () => {
    const draft = branchDraft({
      name: 'Central',
      code: 'CEN',
      address: 'Dirección vieja',
      phone: '0981',
    });
    const payload = branchPayload({ ...draft, address: '', phone: '' });
    expect(JSON.parse(JSON.stringify(payload))).toMatchObject({
      address: '',
      phone: '',
    });
  });
  it('normaliza datos sin convertir el encargado en una asignación de usuario', () => {
    expect(
      branchPayload({
        ...branchDraft(),
        name: ' Central ',
        code: ' cen ',
        manager_name: ' Ana ',
      }),
    ).toMatchObject({ name: 'Central', code: 'CEN', manager_name: 'Ana' });
  });
  it('valida nombre y correo antes de enviar', () => {
    expect(branchDraftIssue(branchDraft())).toBeTruthy();
    expect(
      branchDraftIssue({ ...branchDraft(), name: 'Central', email: 'mal' }),
    ).toBeTruthy();
    expect(
      branchDraftIssue({ ...branchDraft(), name: 'Central', email: '' }),
    ).toBeNull();
  });
});
