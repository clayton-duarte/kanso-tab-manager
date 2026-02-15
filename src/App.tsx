import { useEffect, useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import { useAppStore } from '@/features/store/useAppStore';
import { DashboardLayout } from '@/features/dashboard/DashboardLayout';
import { WelcomeScreen } from '@/features/dashboard/components/WelcomeScreen';

function App() {
  const { isAuthenticated, isInitializing, init, profiles, colorMode } =
    useAppStore();

  // Resolve color mode (system -> actual light/dark)
  const resolvedColorMode = useMemo(() => {
    if (colorMode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return colorMode;
  }, [colorMode]);

  // Apply color mode to document
  useEffect(() => {
    document.documentElement.setAttribute('data-color-mode', resolvedColorMode);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedColorMode);
  }, [resolvedColorMode]);

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (colorMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const newMode = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-color-mode', newMode);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(newMode);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [colorMode]);

  useEffect(() => {
    init();
  }, [init]);

  // Offline-first: If we have cached data, show it immediately
  // This prevents any flash - we either have data or we're truly new
  if (profiles.length > 0 || isAuthenticated) {
    return (
      <Box minH="100vh" bg="bg">
        <DashboardLayout />
      </Box>
    );
  }

  // Still initializing - show blank background (no spinner, no welcome flash)
  if (isInitializing) {
    return <Box h="100vh" w="100vw" bg="bg" />;
  }

  // Not authenticated and done loading - show welcome screen
  return <WelcomeScreen />;
}

export default App;
