import {
  Box,
  VStack,
  Text,
  Input,
  Button,
  Heading,
  Link,
  Alert,
} from '@chakra-ui/react'
import { IconBrandGithub, IconKey, IconFileCode } from '@tabler/icons-react'
import { useState } from 'react'
import { useAppStore } from '@/features/store/useAppStore'

export function WelcomeScreen() {
  const { setCredentials, isLoading, error } = useAppStore()
  const [pat, setPat] = useState('')
  const [gistId, setGistId] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!pat.trim()) {
      setValidationError('Please enter your GitHub Personal Access Token')
      return
    }

    if (!gistId.trim()) {
      setValidationError('Please enter your Gist ID')
      return
    }

    await setCredentials(pat.trim(), gistId.trim())
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
        gap={8}
        maxW="400px"
        w="100%"
        bg="gray.800"
        p={8}
        borderRadius="xl"
        borderWidth="1px"
        borderColor="gray.700"
      >
        <VStack gap={2}>
          <Heading size="lg" color="white">
            Welcome to Zen
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

        <VStack as="form" gap={4} w="100%" onSubmit={handleSubmit}>
          <Box w="100%">
            <Text fontSize="sm" color="gray.400" mb={2}>
              GitHub Personal Access Token (Classic)
            </Text>
            <Box position="relative">
              <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" color="gray.500">
                <IconKey size={18} />
              </Box>
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                pl={10}
                bg="gray.700"
                borderColor="gray.600"
                _hover={{ borderColor: 'gray.500' }}
                _focus={{ borderColor: 'purple.500' }}
              />
            </Box>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Needs &quot;gist&quot; scope.{' '}
              <Link
                href="https://github.com/settings/tokens/new?scopes=gist&description=Zen%20Tab%20Manager"
                target="_blank"
                color="purple.400"
              >
                Create one here
              </Link>
            </Text>
          </Box>

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
                _focus={{ borderColor: 'purple.500' }}
              />
            </Box>
            <Text fontSize="xs" color="gray.500" mt={1}>
              The ID from your private Gist URL (gist.github.com/username/<strong>ID</strong>)
            </Text>
          </Box>

          <Button
            type="submit"
            colorPalette="purple"
            w="100%"
            loading={isLoading}
            loadingText="Connecting..."
          >
            <IconBrandGithub size={18} />
            Connect to GitHub
          </Button>
        </VStack>

        <Text fontSize="xs" color="gray.500" textAlign="center">
          Your token is stored locally and never leaves your browser.
          <br />
          All data is synced directly with your private Gist.
        </Text>
      </VStack>
    </Box>
  )
}
