import { darkTheme, lightTheme, type Theme } from '@garimpo/ui-tokens';
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext<Theme>(darkTheme);

export interface ThemeProviderProps extends PropsWithChildren {
  /** Força um esquema; sem isso segue o sistema (dark é o default do produto). */
  scheme?: 'dark' | 'light';
}

export function ThemeProvider({ scheme, children }: ThemeProviderProps) {
  const system = useColorScheme();
  const resolved = scheme ?? (system === 'light' ? 'light' : 'dark');
  const theme = useMemo(() => (resolved === 'light' ? lightTheme : darkTheme), [resolved]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
