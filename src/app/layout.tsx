import type { Metadata } from 'next';
import { Familjen_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';

import Providers from '@/app/providers';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

// Familjen Grotesk carries headings and controls; Inter runs body copy at small
// sizes; JetBrains Mono is for ids, slugs, payloads and anything columnar.
const display = Familjen_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
});

const sans = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MB Admin Portal',
  description: 'Admin workspace for Masteringbackend',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // next-themes writes the theme class before paint; React would otherwise
      // flag the server/client mismatch on <html>.
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
