const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/pos/components/CheckoutModal.tsx', 'utf8');

code = code.replace(/ElegÃ­ un mÃ©todo simple o combinÃ¡/g, 'Elegí un método simple o combiná');
code = code.replace(/PromociÃ³n/g, 'Promoción');
code = code.replace(/InformaciÃ³n/g, 'Información');
code = code.replace(/ComprobÃ¡/g, 'Comprobá');
code = code.replace(/ConfirmaciÃ³n/g, 'Confirmación');
code = code.replace(/crÃ©dito/g, 'crédito');
code = code.replace(/dÃ­gitos/g, 'dígitos');
code = code.replace(/nÃºmero/g, 'número');
code = code.replace(/lÃ­nea/g, 'línea');
code = code.replace(/reparaciÃ³n/g, 'reparación');
code = code.replace(/estÃ¡/g, 'está');
code = code.replace(/PodÃ©s/g, 'Podés');

fs.writeFileSync('src/app/dashboard/pos/components/CheckoutModal.tsx', code);
