import { useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';

export function getTheme(darkMode = false) {
  return {
    darkMode,
    background: darkMode ? '#0B0B0C' : '#F5F5F7',
    card: darkMode ? '#1C1C1E' : '#FFFFFF',
    elevated: darkMode ? '#2C2C2E' : '#F2F2F7',
    text: darkMode ? '#F5F5F7' : '#1C1C1E',
    subtext: darkMode ? '#D1D1D6' : '#6E6E73',
    muted: darkMode ? '#A9A9B0' : '#8E8E93',
    faint: darkMode ? '#636366' : '#C7C7CC',
    border: darkMode ? '#2C2C2E' : '#E5E5EA',
    button: darkMode ? '#F5F5F7' : '#1C1C1E',
    buttonText: darkMode ? '#0B0B0C' : '#FFFFFF',
    dangerBg: darkMode ? '#351D20' : '#FFF2F2',
    dangerInput: darkMode ? '#2D181B' : '#FFF7F7',
    primary: '#007AFF',
    danger: '#FF3B30',
    warning: '#FFCC00',
  };
}

export function useNotaTheme() {
  const { preferences } = useAppContext();
  const darkMode = Boolean(preferences?.settings?.darkMode);
  const theme = useMemo(() => getTheme(darkMode), [darkMode]);
  return { darkMode, theme };
}
