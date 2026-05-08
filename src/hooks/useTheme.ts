import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'lf-theme';

function readSaved(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'dark';
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readSaved);

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {}
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle, setTheme: setThemeState };
}
