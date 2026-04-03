import type { Metadata } from 'next';
import { IBM_Plex_Sans, Space_Grotesk } from 'next/font/google';
import { connection } from 'next/server';
import './globals.css';

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700']
});

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '700']
});

export const metadata: Metadata = {
  title: 'Ultimate Website Template',
  description: 'A hardened, Docker-first SaaS template with auth, RBAC, session security, and Projects CRUD.'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();

  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} font-sans`}>{children}</body>
    </html>
  );
}
