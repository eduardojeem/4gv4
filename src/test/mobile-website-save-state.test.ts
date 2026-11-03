import { describe, expect, it } from 'vitest';
import { remainingWebsiteEdits } from '../../mobile/src/lib/website-save-state';
describe('guardado concurrente del sitio móvil', () => {
  it('limpia solo los campos que se enviaron y no cambiaron', () => {
    expect(
      remainingWebsiteEdits(
        { name: 'Nombre enviado', phone: 'Nuevo número' },
        { name: 'Nombre enviado', phone: 'Número enviado' },
      ),
    ).toEqual({ phone: 'Nuevo número' });
  });
  it('conserva una imagen cuya subida termina durante el guardado', () => {
    expect(
      remainingWebsiteEdits(
        { name: 'Tienda', logoUrl: 'nuevo.png' },
        { name: 'Tienda' },
      ),
    ).toEqual({ logoUrl: 'nuevo.png' });
  });
});
