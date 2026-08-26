const fs = require('fs');
let code = fs.readFileSync('src/components/pos/ReceiptGenerator.tsx', 'utf8');

// The file seems to have latin1/ANSI encoding issues for emojis because of PowerShell's earlier output, let's just do a clean string replacement.
code = code.replace(/dY\?/g, '');
code = code.replace(/dY\"\./g, '');
code = code.replace(/\?/g, '');
code = code.replace(/dY \?/g, '');
code = code.replace(/dY\ /g, '');
code = code.replace(/dY\/g, '');
code = code.replace(/dY\"/g, '');
code = code.replace(/o\"/g, '');
code = code.replace(/dY\'/g, '');
code = code.replace(/dYZ%/g, '');
code = code.replace(/A/g, '¡');
code = code.replace(/A\?/g, 'í');
code = code.replace(/dY>\,\?/g, '');
code = code.replace(/VAlido/g, 'Válido');
code = code.replace(/ReparaciA3n/g, 'Reparación');
code = code.replace(/NA/g, 'Nº');
code = code.replace(/TelAcfono/g, 'Teléfono');
code = code.replace(/CrAcdito/g, 'Crédito');
code = code.replace(/Interes credito/g, 'Interés crédito');
code = code.replace(/dY\"\/g, '');
code = code.replace(/dY\" /g, '');
code = code.replace(/~Z/g, '');
code = code.replace(/A-/g, 'x'); // For 'A- formatCurrency' => 'x formatCurrency'

// Replace any remaining unicode emojis
code = code.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu, '');

// Clean up payment icons and labels
code = code.replace(/cash: '.*Efectivo'/, \"cash: 'Efectivo'\");
code = code.replace(/card: '.*Tarjeta'/, \"card: 'Tarjeta'\");
code = code.replace(/transfer: '.*Transferencia'/, \"transfer: 'Transferencia'\");
code = code.replace(/credit: '.*Crédito'/, \"credit: 'Crédito'\");

// Payment icon function replacement
code = code.replace(/const getPaymentIcon = [\\s\\S]*?return icons\\[method as keyof typeof icons\\] \\|\\| '.*?'\\n  }/, 'const getPaymentIcon = (method: string) => \"\"');

// Update main wrapper classes
code = code.replace('className=\"max-w-md mx-auto bg-card text-foreground rounded-lg shadow-lg border border-border\"', 'className=\"max-w-md mx-auto bg-card text-foreground rounded-lg shadow-lg border border-border print:max-w-full print:shadow-none print:border-none print:rounded-none print:mx-0 print:bg-transparent print:text-black\"');

// Remove extra padding on print
code = code.replace(/px-4/g, 'px-4 print:px-0');

fs.writeFileSync('src/components/pos/ReceiptGenerator.tsx', code);
