import { useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { useAppStore } from '@/features/store/useAppStore';
import { DashboardLayout } from '@/features/dashboard/DashboardLayout';
import { WelcomeScreen } from '@/features/dashboard/components/WelcomeScreen';

function App() {
  const { isAuthenticated, isInitializing, init, profiles } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  // Offline-first: If we have cached data, show it immediately
  // This prevents any flash - we either have data or we're truly new
  if (profiles.length > 0 || isAuthenticated) {
    return (
      <Box minH="100vh" bg="gray.900">
        <DashboardLayout />
      </Box>
    );
  }

  // Still initializing - show blank background (no spinner, no welcome flash)
  if (isInitializing) {
    return <Box h="100vh" w="100vw" bg="gray.900" />;
  }

  // Not authenticated and done loading - show welcome screen
  return <WelcomeScreen />;
}

export default App;
