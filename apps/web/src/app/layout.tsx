import type { Metadata } from 'next';
import { Fraunces, Space_Grotesk } from 'next/font/google';

import './globals.css';
import { AuthProvider } from '@/lib/auth';

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
    <html lang="en">
      <body className={`${heading.variable} ${body.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
