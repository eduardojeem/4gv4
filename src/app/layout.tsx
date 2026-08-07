import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/contexts/theme-context";
import { AccessibilityProvider } from "@/contexts/accessibility-context";
import { AuthProvider } from "@/contexts/auth-context";
import { AppStateProvider } from "@/contexts/app-state-context";
import { BranchProvider } from "@/contexts/branch-context";
import { SWRProvider } from "@/providers/swr-provider";
import { Toaster } from "sonner";
import { DEFAULT_SYSTEM_COLOR_SCHEME } from "@/lib/theme/color-schemes";
import { DEFAULT_PLATFORM_BRANDING, getPlatformBranding } from "@/lib/platform/branding";
import "./globals.css";
import { PredictivePrefetchInit } from "@/components/util/PredictivePrefetchInit";
import { ThemeInitScript } from "@/components/util/ThemeInitScript";
import { RegionalSettingsBoundary } from "@/components/providers/regional-settings-boundary";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  let branding = DEFAULT_PLATFORM_BRANDING;

  try {
    branding = await getPlatformBranding();
  } catch {
    branding = DEFAULT_PLATFORM_BRANDING;
  }

  return {
    title: branding.platformName,
    description: branding.seoDescription,
    icons: {
      icon: branding.logoUrl || '/globe.svg',
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning data-color-scheme={DEFAULT_SYSTEM_COLOR_SCHEME}>
      <head>
        {/* Script anti-flash de tema, inyectado vía useServerInsertedHTML
            (ver ThemeInitScript) en vez de un <script>/<Script> JSX normal:
            tanto el <script> crudo como next/script strategy="beforeInteractive"
            disparan "Encountered a script tag while rendering React component"
            en Next 16 + React 19 (warning conocido, reportado también contra
            next-themes/shadcn/HeroUI). El script en sí funciona bien en SSR;
            useServerInsertedHTML es el mecanismo soportado para inyectar HTML
            directo al stream sin que React lo trate como un nodo a reconciliar. */}
        <ThemeInitScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased theme-transition`}
      >
        <ThemeProvider defaultColorScheme={DEFAULT_SYSTEM_COLOR_SCHEME}>
          <AccessibilityProvider>
            <AuthProvider>
              <RegionalSettingsBoundary>
                <AppStateProvider>
                  <BranchProvider>
                    <SWRProvider>
                      <PredictivePrefetchInit />
                      <main id="main-content" tabIndex={-1}>
                        {children}
                      </main>
                      <Toaster
                      position="top-right"
                      richColors
                      closeButton
                      duration={4000}
                      visibleToasts={5}
                      expand={true}
                      gap={8}
                      offset={16}
                      toastOptions={{
                        // No fijar background/color/border aca: los estilos inline
                        // ganan por especificidad y anularian `richColors` y los
                        // bordes por tipo, dejando exito/error/aviso identicos.
                        style: {
                          fontSize: '14px',
                          borderRadius: '10px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        },
                        className: 'toast-optimized',
                        descriptionClassName: 'toast-description',
                        actionButtonStyle: {
                          background: 'hsl(var(--primary))',
                          color: 'hsl(var(--primary-foreground))',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: '500',
                        },
                        cancelButtonStyle: {
                          background: 'hsl(var(--secondary))',
                          color: 'hsl(var(--secondary-foreground))',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }
                      }}
                      />
                    </SWRProvider>
                  </BranchProvider>
                </AppStateProvider>
              </RegionalSettingsBoundary>
            </AuthProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
