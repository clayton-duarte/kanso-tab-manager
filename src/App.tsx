import { useEffect } from 'react'
import { Box, Spinner, Flex } from '@chakra-ui/react'
import { useAppStore } from '@/features/store/useAppStore'
import { DashboardLayout } from '@/features/dashboard/DashboardLayout'
import { WelcomeScreen } from '@/features/dashboard/components/WelcomeScreen'

function App() {
  const { isAuthenticated, isLoading, init, accentColor } = useAppStore()

  useEffect(() => {
    init()
  }, [init])

  // Show loading spinner during initialization
  if (isLoading) {
    return (
      <Flex
        h="100vh"
        w="100vw"
        align="center"
        justify="center"
        bg="gray.900"
      >
        <Spinner size="xl" color={`${accentColor}.500`} />
      </Flex>
    )
  }

  // Show welcome screen if not authenticated
  if (!isAuthenticated) {
    return <WelcomeScreen />
  }

  // Show main dashboard
  return (
    <Box minH="100vh" bg="gray.900">
      <DashboardLayout />
    </Box>
  )
}

export default App
