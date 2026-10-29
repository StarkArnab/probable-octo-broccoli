import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import './theme.css';
import { ThemeProvider } from './components/theme-provider';
export const metadata: Metadata = { title: 'Orbit — Your personal workspace', description: 'A quiet space to turn ideas into progress.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider><Analytics /></body></html>;
}
