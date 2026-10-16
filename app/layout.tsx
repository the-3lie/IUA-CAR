import type { Metadata, Viewport } from 'next';
import './globals.css';
import EnregistreurSW from '@/components/EnregistreurSW';

export const metadata: Metadata = {
  title: { default: 'Contrôle Car', template: '%s · Contrôle Car' },
  description: 'Paiement et accès aux cars universitaires.',
  applicationName: 'Contrôle Car',
  appleWebApp: { capable: true, title: 'Contrôle Car', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b1d33',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <EnregistreurSW />
      </body>
    </html>
  );
}
