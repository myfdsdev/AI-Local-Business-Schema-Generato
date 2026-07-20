import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'localschema-theme';
const ThemeContext = createContext(null);

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/** 'system' resolves against the OS setting; the others are explicit. */
function resolve(theme) {
  return theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;
}

function applyToDocument(theme) {
  document.documentElement.classList.toggle('dark', resolve(theme) === 'dark');
}

/**
 * Theme state for the app. Tailwind is configured with darkMode: ['class'], and
 * index.css defines the .dark token set — this provider is what actually puts
 * that class on <html>, persists the choice, and follows the OS while on
 * 'system'. index.html applies the stored value before paint to avoid a flash.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    return localStorage.getItem(STORAGE_KEY) ?? 'system';
  });

  useEffect(() => {
    applyToDocument(theme);

    // Only track OS changes while the user hasn't picked an explicit theme.
    if (theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyToDocument('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme: resolve(theme) }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
