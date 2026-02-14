import {
  Box,
  VStack,
  Text,
  Input,
  Button,
  Heading,
  HStack,
} from '@chakra-ui/react'
import { IconX, IconLogout, IconKey, IconFileCode } from '@tabler/icons-react'
import { useState } from 'react'
import { useAppStore } from '@/features/store/useAppStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { pat, gistId, setCredentials, clearCredentials, isLoading } = useAppStore()
  const [newPat, setNewPat] = useState(pat || '')
  const [newGistId, setNewGistId] = useState(gistId || '')

  if (!isOpen) return null

  const handleSave = async () => {
    if (newPat.trim() && newGistId.trim()) {
      await setCredentials(newPat.trim(), newGistId.trim())
      onClose()
    }
  }

  const handleLogout = () => {
    clearCredentials()
    onClose()
  }

  return (
    <Box
      position="fixed"
      inset={0}
      bg="blackAlpha.700"
      display="flex"
      alignItems="center"
      justifyContent="center"
      zIndex={50}
      onClick={onClose}
    >
      <Box
        bg="gray.800"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="gray.700"
        p={6}
        maxW="400px"
        w="100%"
        mx={4}
        onClick={(e) => e.stopPropagation()}
      >
        <HStack justify="space-between" mb={6}>
          <Heading size="md" color="white">
            Settings
          </Heading>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            color="gray.400"
            _hover={{ color: 'white' }}
          >
            <IconX size={20} />
          </Button>
        </HStack>

        <VStack gap={4} align="stretch">
          <Box>
            <Text fontSize="sm" color="gray.400" mb={2}>
              GitHub Personal Access Token
            </Text>
            <Box position="relative">
              <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" color="gray.500">
                <IconKey size={18} />
              </Box>
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={newPat}
                onChange={(e) => setNewPat(e.target.value)}
                pl={10}
                bg="gray.700"
                borderColor="gray.600"
                _hover={{ borderColor: 'gray.500' }}
                _focus={{ borderColor: 'purple.500' }}
              />
            </Box>
          </Box>

          <Box>
            <Text fontSize="sm" color="gray.400" mb={2}>
              Gist ID
            </Text>
            <Box position="relative">
              <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" color="gray.500">
                <IconFileCode size={18} />
              </Box>
              <Input
                placeholder="abc123def456..."
                value={newGistId}
                onChange={(e) => setNewGistId(e.target.value)}
                pl={10}
                bg="gray.700"
                borderColor="gray.600"
                _hover={{ borderColor: 'gray.500' }}
                _focus={{ borderColor: 'purple.500' }}
              />
            </Box>
          </Box>

          <HStack gap={2} pt={2}>
            <Button
              colorPalette="purple"
              flex={1}
              onClick={handleSave}
              loading={isLoading}
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              colorPalette="red"
              onClick={handleLogout}
            >
              <IconLogout size={18} />
              Logout
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  )
}
