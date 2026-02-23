import type { Metadata } from 'next';
import { Fraunces, Space_Grotesk } from 'next/font/google';

import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { themeBootstrapScript, themeCssText } from '@/theme/theme-config';

const heading = Fraunces({
  subsets: ['latin'],
  variable: '--font-heading',
});

const body = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'TkTurners Finance Ops',
  description: 'Private finance ops workspace for founders',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <style id="theme-config">{themeCssText}</style>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={`${heading.variable} ${body.variable}`}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
