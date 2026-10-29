'use client';

import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Browser preferences are unavailable during SSR. Keep the initial markup stable.
  useEffect(() => setMounted(true), []);

  return (
    <label className="theme-selector">
      <Monitor size={14} aria-hidden="true" />
      <span className="sr-only">Color theme</span>
      <select
        value={mounted ? theme ?? 'system' : 'system'}
        onChange={event => setTheme(event.target.value)}
        disabled={!mounted}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}
