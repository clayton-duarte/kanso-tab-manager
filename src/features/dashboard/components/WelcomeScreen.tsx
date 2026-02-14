import {
  Box,
  VStack,
  Text,
  Input,
  Button,
  Heading,
  Link,
  Alert,
  Tabs,
} from '@chakra-ui/react'
import { IconBrandGithub, IconKey, IconFileCode, IconSparkles, IconLink } from '@tabler/icons-react'
import { useState } from 'react'
import { useAppStore } from '@/features/store/useAppStore'

type SetupMode = 'new' | 'existing'

export function WelcomeScreen() {
  const { setCredentials, setupWithNewGist, isLoading, error, accentColor } = useAppStore()
  const [pat, setPat] = useState('')
  const [gistId, setGistId] = useState('')
  const [mode, setMode] = useState<SetupMode>('new')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!pat.trim()) {
      setValidationError('Please enter your GitHub Personal Access Token')
      return
    }

    if (mode === 'new') {
      // Create a new Gist automatically
      await setupWithNewGist(pat.trim())
    } else {
      // Connect to existing Gist
      if (!gistId.trim()) {
        setValidationError('Please enter your Gist ID')
        return
      }
      await setCredentials(pat.trim(), gistId.trim())
    }
  }

  return (
    <Box
      minH="100vh"
      bg="gray.900"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={8}
    >
      <VStack
        gap={6}
        maxW="440px"
        w="100%"
        bg="gray.800"
        p={8}
        borderRadius="xl"
        borderWidth="1px"
        borderColor="gray.700"
      >
        <VStack gap={2}>
          <Heading size="lg" color="white">
            Welcome to Kanso
          </Heading>
          <Text color="gray.400" textAlign="center">
            A privacy-first tab manager using GitHub Gist as your database
          </Text>
        </VStack>

        {(error || validationError) && (
          <Alert.Root status="error" borderRadius="md">
            <Alert.Indicator />
            <Alert.Title>{validationError || error}</Alert.Title>
          </Alert.Root>
        )}

        <Tabs.Root
          value={mode}
          onValueChange={(details) => setMode(details.value as SetupMode)}
          w="100%"
          variant="enclosed"
        >
          <Tabs.List w="100%" bg="gray.900" borderRadius="lg" p={1}>
            <Tabs.Trigger
              value="new"
              flex={1}
              fontSize="sm"
              color="gray.400"
              borderRadius="md"
              _selected={{ bg: `${accentColor}.900/50`, color: `${accentColor}.300` }}
            >
              <IconSparkles size={16} />
              New Setup
            </Tabs.Trigger>
            <Tabs.Trigger
              value="existing"
              flex={1}
              fontSize="sm"
              color="gray.400"
              borderRadius="md"
              _selected={{ bg: `${accentColor}.900/50`, color: `${accentColor}.300` }}
            >
              <IconLink size={16} />
              Restore / Connect
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>

        <VStack as="form" gap={4} w="100%" onSubmit={handleSubmit}>
          <Box w="100%">
            <Text fontSize="sm" color="gray.400" mb={2}>
              GitHub Personal Access Token
            </Text>
            <Box position="relative">
              <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" color="gray.500">
                <IconKey size={18} />
              </Box>
              <Input
                type="password"
                placeholder="github_pat_xxxxxxxxxxxx"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                pl={10}
                bg="gray.700"
                borderColor="gray.600"
                _hover={{ borderColor: 'gray.500' }}
                _focus={{ borderColor: `${accentColor}.500` }}
              />
            </Box>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Create a fine-grained PAT with only "Gists" permission.{' '}
              <Link
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                color={`${accentColor}.400`}
              >
                Create one here
              </Link>
            </Text>
          </Box>

          {mode === 'existing' && (
            <Box w="100%">
              <Text fontSize="sm" color="gray.400" mb={2}>
                Gist ID
              </Text>
              <Box position="relative">
                <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" color="gray.500">
                  <IconFileCode size={18} />
                </Box>
                <Input
                  placeholder="abc123def456..."
                  value={gistId}
                  onChange={(e) => setGistId(e.target.value)}
                  pl={10}
                  bg="gray.700"
                  borderColor="gray.600"
                  _hover={{ borderColor: 'gray.500' }}
                  _focus={{ borderColor: `${accentColor}.500` }}
                />
              </Box>
              <Text fontSize="xs" color="gray.500" mt={1}>
                The ID from your existing Kanso Gist URL
              </Text>
            </Box>
          )}

          <Button
            type="submit"
            colorPalette={accentColor}
            w="100%"
            loading={isLoading}
            loadingText={mode === 'new' ? 'Creating...' : 'Connecting...'}
          >
            <IconBrandGithub size={18} />
            {mode === 'new' ? 'Get Started' : 'Connect to Gist'}
          </Button>
        </VStack>

        <Text fontSize="xs" color="gray.500" textAlign="center">
          Your token is stored locally and never leaves your browser.
          {mode === 'new' && (
            <>
              <br />
              A private Gist will be created to store your data.
            </>
          )}
        </Text>
      </VStack>
    </Box>
  )
}
