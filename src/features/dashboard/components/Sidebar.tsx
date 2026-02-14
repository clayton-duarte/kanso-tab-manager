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
  IconPencil,
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
    renameWorkspace,
    accentColor,
  } = useAppStore()

  const [isCreating, setIsCreating] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null)
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('')

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

  const handleStartRename = (e: React.MouseEvent, workspace: { id: string; name: string }) => {
    e.stopPropagation()
    setEditingWorkspaceId(workspace.id)
    setEditingWorkspaceName(workspace.name)
  }

  const handleRenameWorkspace = async () => {
    if (editingWorkspaceId && editingWorkspaceName.trim()) {
      await renameWorkspace(editingWorkspaceId, editingWorkspaceName.trim())
    }
    setEditingWorkspaceId(null)
    setEditingWorkspaceName('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameWorkspace()
    } else if (e.key === 'Escape') {
      setEditingWorkspaceId(null)
      setEditingWorkspaceName('')
    }
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
          colorPalette={accentColor}
          onClick={() => setIsCreating(true)}
        >
          <IconPlus size={14} />
        </IconButton>
      </Flex>

      <VStack gap={1} align="stretch" p={2}>
        {profileWorkspaces.map(workspace => (
          editingWorkspaceId === workspace.id ? (
            <HStack key={workspace.id} gap={1} px={2}>
              <Input
                size="sm"
                value={editingWorkspaceName}
                onChange={(e) => setEditingWorkspaceName(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                autoFocus
                variant="outline"
              />
              <IconButton
                aria-label="Confirm"
                size="xs"
                colorPalette="green"
                onClick={handleRenameWorkspace}
              >
                <IconCheck size={14} />
              </IconButton>
              <IconButton
                aria-label="Cancel"
                size="xs"
                variant="ghost"
                colorPalette="red"
                onClick={() => {
                  setEditingWorkspaceId(null)
                  setEditingWorkspaceName('')
                }}
              >
                <IconX size={14} />
              </IconButton>
            </HStack>
          ) : (
            <Flex
              key={workspace.id}
              align="center"
              gap={2}
              px={3}
              py={2}
              borderRadius="md"
              cursor="pointer"
              bg={activeWorkspaceId === workspace.id ? `${accentColor}.900/40` : 'transparent'}
              color={activeWorkspaceId === workspace.id ? `${accentColor}.300` : 'gray.400'}
              borderLeftWidth="2px"
              borderLeftColor={activeWorkspaceId === workspace.id ? `${accentColor}.500` : 'transparent'}
              onClick={() => switchWorkspace(workspace.id)}
            >
              <IconFolder size={16} />
              <Text fontSize="sm" flex={1} lineClamp={1}>
                {workspace.name}
              </Text>
              <IconButton
                aria-label="Rename workspace"
                size="xs"
                variant="ghost"
                colorPalette={accentColor}
                onClick={(e) => handleStartRename(e, workspace)}
              >
                <IconPencil size={14} />
              </IconButton>
              <IconButton
                aria-label="Delete workspace"
                size="xs"
                variant="ghost"
                colorPalette="red"
                onClick={(e) => handleDeleteWorkspace(e, workspace.id)}
              >
                <IconTrash size={14} />
              </IconButton>
            </Flex>
          )
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
              variant="outline"
            />
            <IconButton
              aria-label="Confirm"
              size="xs"
              variant="ghost"
              colorPalette="green"
              onClick={handleCreateWorkspace}
            >
              <IconCheck size={14} />
            </IconButton>
            <IconButton
              aria-label="Cancel"
              size="xs"
              variant="ghost"
              colorPalette="red"
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
              color={`${accentColor}.400`}
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
