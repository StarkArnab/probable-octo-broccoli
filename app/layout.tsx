import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
export const metadata: Metadata = { title: 'Orbit — Your personal workspace', description: 'A quiet space to turn ideas into progress.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}<Analytics /></body></html>;
}
