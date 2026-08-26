const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/pos/components/CheckoutModal.tsx', 'utf8');

// The file was likely encoded in utf-8, but let's fix known broken words
code = code.replace(/A/g, '¡');
code = code.replace(/Acxito/g, 'éxito');
code = code.replace(/OcurriA3/g, 'Ocurrió');
code = code.replace(/conexiA3n/g, 'conexión');
code = code.replace(/IdentificA/g, 'Identificá');
code = code.replace(/vinculA/g, 'vinculá');
code = code.replace(/Acn/g, 'én');
code = code.replace(/Acs/g, 'és');
code = code.replace(/CrAcdito/g, 'Crédito');
code = code.replace(/crAcdito/g, 'crédito');
code = code.replace(/financiaciA3n/g, 'financiación');
code = code.replace(/Acdito/g, 'édito');
code = code.replace(/A3/g, 'ó');
code = code.replace(/A-/g, 'í');
code = code.replace(/A\?/g, 'í');

fs.writeFileSync('src/app/dashboard/pos/components/CheckoutModal.tsx', code);
