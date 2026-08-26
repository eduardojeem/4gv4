const fs = require('fs');
let code = fs.readFileSync('checkout.temp.tsx', 'utf8');

// Fix encodings
code = code.replace(/VerificA. el cliente, elegA.- cA3mo cobra la venta y confirmA. el total./g, 'Verificá el cliente, elegí cómo cobra la venta y confirmá el total.');
code = code.replace(/mActodo/g, 'método');
code = code.replace(/IdentificA. al comprador y vinculA. reparaciones si corresponde./g, 'Identificá al comprador y vinculá reparaciones si corresponde.');
code = code.replace(/ElegA- cA3mo vas a cobrar el total de la venta./g, 'Elegí cómo vas a cobrar el total de la venta.');

// Improve Dialog wrapper classes
code = code.replace(/className="flex max-h-\[92vh\] w-\[95vw\] flex-col overflow-hidden p-0 max-sm:h-\[100dvh\] max-sm:max-h-\[100dvh\] max-sm:w-screen max-sm:max-w-full max-sm:rounded-none sm:max-w-3xl md:max-w-5xl lg:max-w-6xl"/g, 'className="flex max-h-[92vh] w-[95vw] flex-col overflow-hidden p-0 border-0 shadow-2xl rounded-2xl max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-full max-sm:rounded-none sm:max-w-3xl md:max-w-5xl lg:max-w-6xl"');

// Improve Dialog header
code = code.replace(/className="shrink-0 border-b bg-muted\/30 px-4 py-3 pr-12 sm:px-6 sm:py-4"/g, 'className="shrink-0 border-b bg-slate-50\/80 dark:bg-slate-900\/80 backdrop-blur-sm px-5 py-4 pr-12 sm:px-7 sm:py-5"');
code = code.replace(/className="flex items-center gap-2 text-base sm:text-lg"/g, 'className="flex items-center gap-3 text-lg sm:text-xl font-bold tracking-tight"');
code = code.replace(/className="text-xs sm:text-sm"/g, 'className="text-sm mt-1 text-slate-500 dark:text-slate-400"');
code = code.replace(/className="h-4 w-4 text-primary"/g, 'className="h-6 w-6 text-primary p-1 bg-primary\/10 rounded-lg"');

// Improve stepper
code = code.replace(/className="shrink-0 border-b bg-background\/95 px-4 py-2\.5 sm:px-6 sm:py-3"/g, 'className="shrink-0 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-5 py-3 sm:px-7 sm:py-4"');

// Improve sections
code = code.replace(/className="space-y-4 rounded-xl border bg-card\/70 p-4 md:p-5"/g, 'className="space-y-4 rounded-2xl border shadow-sm bg-white dark:bg-slate-950 p-5 md:p-6"');
code = code.replace(/className="flex items-center gap-3 border-b pb-3"/g, 'className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4"');
code = code.replace(/className="flex h-8 w-8 items-center justify-center rounded-full bg-primary\/10 text-primary"/g, 'className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm"');
code = code.replace(/className="text-sm font-semibold"/g, 'className="text-base font-bold text-slate-900 dark:text-slate-100"');
code = code.replace(/className="text-xs text-muted-foreground"/g, 'className="text-sm text-slate-500 dark:text-slate-400 mt-0.5"');

// Remove bottom ugly borders
code = code.replace(/className="shrink-0 border-t bg-muted\/30 px-4 py-3 sm:px-6 sm:py-4"/g, 'className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50\/80 dark:bg-slate-900\/80 backdrop-blur-sm px-5 py-4 sm:px-7 sm:py-5"');

fs.writeFileSync('src/app/dashboard/pos/components/CheckoutModal.tsx', code);
