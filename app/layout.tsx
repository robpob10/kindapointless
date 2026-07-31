import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TITLE, NAME } from '@/lib/config';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: TITLE,
  description: `Pointless (with a twist) about ${NAME}, for the stag do.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
