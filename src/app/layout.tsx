import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/contexts/theme-context";
import { AccessibilityProvider } from "@/contexts/accessibility-context";
import { AuthProvider } from "@/contexts/auth-context";
import { AppStateProvider } from "@/contexts/app-state-context";
import { SWRProvider } from "@/providers/swr-provider";
import { Toaster } from "sonner";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/util/ServiceWorkerRegistration";
import { PredictivePrefetchInit } from "@/components/util/PredictivePrefetchInit";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "4G celulares - Sistema de Gestión",
  description: "Sistema completo de gestión para reparación de celulares y punto de venta",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning data-color-scheme="corporate">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased theme-transition`}
      >
        <ThemeProvider>
          <AccessibilityProvider>
            <AuthProvider>
              <AppStateProvider>
                <SWRProvider>
                  <ServiceWorkerRegistration />
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
                      style: {
                        background: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        fontSize: '14px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        backdropFilter: 'blur(8px)',
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
              </AppStateProvider>
            </AuthProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
