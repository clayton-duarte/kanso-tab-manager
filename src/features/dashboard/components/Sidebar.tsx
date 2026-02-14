import {
  Box,
  VStack,
  Text,
  IconButton,
  Flex,
  Input,
  HStack,
} from '@chakra-ui/react'
import {
  IconPlus,
  IconFolder,
  IconCheck,
  IconX,
  IconTrash,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useAppStore } from '@/features/store/useAppStore'

export function Sidebar() {
  const {
    profiles,
    workspaces,
    activeProfileId,
    activeWorkspaceId,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
  } = useAppStore()

  const [isCreating, setIsCreating] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [hoveredWorkspaceId, setHoveredWorkspaceId] = useState<string | null>(null)

  // Get current profile name
  const activeProfile = profiles.find(p => p.id === activeProfileId)
  
  // Filter workspaces for current profile
  const profileWorkspaces = workspaces.filter(
    w => w.profile === activeProfile?.name
  )

  const handleCreateWorkspace = async () => {
    if (newWorkspaceName.trim()) {
      await createWorkspace(newWorkspaceName.trim())
      setNewWorkspaceName('')
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateWorkspace()
    } else if (e.key === 'Escape') {
      setIsCreating(false)
      setNewWorkspaceName('')
    }
  }

  const handleDeleteWorkspace = async (e: React.MouseEvent, workspaceId: string) => {
    e.stopPropagation()
    await deleteWorkspace(workspaceId)
  }

  return (
    <Box
      as="aside"
      bg="gray.850"
      borderRightWidth="1px"
      borderColor="gray.700"
      w="240px"
      minW="240px"
      h="100%"
      overflowY="auto"
    >
      <Flex
        justify="space-between"
        align="center"
        px={4}
        py={3}
        borderBottomWidth="1px"
        borderColor="gray.700"
      >
        <Text fontSize="xs" fontWeight="semibold" color="gray.400" textTransform="uppercase">
          Workspaces
        </Text>
        <IconButton
          aria-label="Add workspace"
          size="xs"
          variant="ghost"
          color="gray.500"
          onClick={() => setIsCreating(true)}
          _hover={{ color: 'white', bg: 'gray.700' }}
        >
          <IconPlus size={14} />
        </IconButton>
      </Flex>

      <VStack gap={1} align="stretch" p={2}>
        {profileWorkspaces.map(workspace => (
          <Flex
            key={workspace.id}
            align="center"
            gap={2}
            px={3}
            py={2}
            borderRadius="md"
            cursor="pointer"
            bg={activeWorkspaceId === workspace.id ? 'gray.700' : 'transparent'}
            color={activeWorkspaceId === workspace.id ? 'white' : 'gray.400'}
            _hover={{ bg: 'gray.700', color: 'white' }}
            onClick={() => switchWorkspace(workspace.id)}
            onMouseEnter={() => setHoveredWorkspaceId(workspace.id)}
            onMouseLeave={() => setHoveredWorkspaceId(null)}
          >
            <IconFolder size={16} />
            <Text fontSize="sm" flex={1} noOfLines={1}>
              {workspace.name}
            </Text>
            {hoveredWorkspaceId === workspace.id && (
              <IconButton
                aria-label="Delete workspace"
                size="xs"
                variant="ghost"
                color="gray.500"
                onClick={(e) => handleDeleteWorkspace(e, workspace.id)}
                _hover={{ color: 'red.400' }}
              >
                <IconTrash size={14} />
              </IconButton>
            )}
          </Flex>
        ))}

        {isCreating && (
          <HStack gap={1} px={2}>
            <Input
              size="sm"
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              bg="gray.800"
              borderColor="gray.600"
              _focus={{ borderColor: 'purple.500' }}
            />
            <IconButton
              aria-label="Confirm"
              size="xs"
              variant="ghost"
              color="green.400"
              onClick={handleCreateWorkspace}
            >
              <IconCheck size={14} />
            </IconButton>
            <IconButton
              aria-label="Cancel"
              size="xs"
              variant="ghost"
              color="red.400"
              onClick={() => {
                setIsCreating(false)
                setNewWorkspaceName('')
              }}
            >
              <IconX size={14} />
            </IconButton>
          </HStack>
        )}

        {profileWorkspaces.length === 0 && !isCreating && (
          <Text fontSize="sm" color="gray.500" px={3} py={4} textAlign="center">
            No workspaces yet.{' '}
            <Text
              as="span"
              color="purple.400"
              cursor="pointer"
              onClick={() => setIsCreating(true)}
            >
              Create one
            </Text>
          </Text>
        )}
      </VStack>
    </Box>
  )
}
