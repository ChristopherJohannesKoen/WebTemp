import type { Metadata } from 'next';
import { IBM_Plex_Sans, Space_Grotesk } from 'next/font/google';
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
  description: 'A Docker-first, app-first SaaS starter with auth, RBAC, and Projects CRUD.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} font-sans`}>{children}</body>
    </html>
  );
}
