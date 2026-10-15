/**
 * Alto contraste para los comprobantes que se imprimen desde HTML.
 *
 * Los tickets usaban grises (#666, #999), verdes y azules suaves y fondos
 * claros. En impresora termica eso sale lavado o tramado, y a los pocos meses
 * el papel no se lee. Esta hoja va al final del <style> de cada comprobante y
 * pisa lo anterior:
 *
 * - todo el texto negro puro y en negrita;
 * - sin fondos de color ni sombras: solo bordes negros;
 * - los titulos de seccion (h2/h3 o `.pc-band`) en banda negra con letra blanca;
 * - los totales (`.pc-total`, `[data-receipt-total]`) mas grandes y enmarcados.
 *
 * Las imagenes (logo) quedan como estan.
 */
export const HIGH_CONTRAST_PRINT_CSS = `
  body, body * {
    color: #000 !important;
    font-weight: 700 !important;
    text-shadow: none !important;
    opacity: 1 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body *:not(img):not(svg) {
    background: transparent !important;
    box-shadow: none !important;
    border-color: #000 !important;
  }
  body h1, body .pc-title {
    font-weight: 900 !important;
    letter-spacing: 0.3px;
  }
  body h2, body h3, body .pc-band, body .section-title {
    background: #000 !important;
    font-weight: 900 !important;
    text-transform: uppercase;
    border-radius: 0 !important;
    padding-top: 3px !important;
    padding-bottom: 3px !important;
  }
  body h2, body h2 *, body h3, body h3 *, body .pc-band, body .pc-band *, body .section-title, body .section-title * {
    color: #fff !important;
  }
  body .pc-total, body [data-receipt-total] {
    border: 2px solid #000 !important;
    border-radius: 0 !important;
    font-size: 1.15em !important;
    font-weight: 900 !important;
  }
  body .pc-total *, body [data-receipt-total] * {
    font-weight: 900 !important;
  }
  hr, body .separator {
    border-color: #000 !important;
    border-top-width: 1.5px !important;
  }
`
