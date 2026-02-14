import {
  Box,
  VStack,
  Text,
  Input,
  Button,
  Heading,
  HStack,
  Drawer,
  Portal,
  CloseButton,
  Link,
  Dialog,
} from '@chakra-ui/react'
import {
  IconLogout,
  IconKey,
  IconExternalLink,
  IconTrash,
  IconCheck,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useAppStore } from '@/features/store/useAppStore'

interface SettingsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDrawer({ open, onOpenChange }: SettingsDrawerProps) {
  const {
    pat,
    gistId,
    setCredentials,
    clearCredentials,
    deleteGistAndLogout,
    isLoading,
  } = useAppStore()

  const [editingPat, setEditingPat] = useState(false)
  const [newPat, setNewPat] = useState(pat || '')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleClose = () => {
    onOpenChange(false)
    setEditingPat(false)
    setNewPat(pat || '')
  }

  const handleSavePat = async () => {
    if (newPat.trim() && gistId) {
      await setCredentials(newPat.trim(), gistId)
      setEditingPat(false)
    }
  }

  const handleDisconnect = () => {
    clearCredentials()
    handleClose()
  }

  const handleDeleteGist = async () => {
    setIsDeleting(true)
    try {
      await deleteGistAndLogout()
      setShowDeleteConfirm(false)
      handleClose()
    } finally {
      setIsDeleting(false)
    }
  }

  const gistUrl = gistId ? `https://gist.github.com/${gistId}` : ''

  return (
    <>
    <Drawer.Root
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      placement="end"
      size="sm"
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content bg="gray.800" borderColor="gray.700" borderLeftWidth="1px">
            <Drawer.Header borderBottomWidth="1px" borderColor="gray.700">
              <Drawer.Title color="white">Settings</Drawer.Title>
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" color="gray.400" _hover={{ color: 'white' }} />
              </Drawer.CloseTrigger>
            </Drawer.Header>

            <Drawer.Body py={6}>
              <VStack gap={6} align="stretch">
                {/* Gist Link Section */}
                <Box>
                  <Text fontSize="sm" color="gray.400" mb={2}>
                    Your Gist
                  </Text>
                  <Box
                    bg="gray.700"
                    borderRadius="md"
                    p={3}
                    borderWidth="1px"
                    borderColor="gray.600"
                  >
                    <HStack justify="space-between" align="center">
                      <Link
                        href={gistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        color="purple.300"
                        fontSize="sm"
                        _hover={{ color: 'purple.200', textDecoration: 'underline' }}
                        display="flex"
                        alignItems="center"
                        gap={2}
                      >
                        <IconExternalLink size={16} />
                        View Gist on GitHub
                      </Link>
                    </HStack>
                    <Text fontSize="xs" color="gray.500" mt={2} fontFamily="mono">
                      ID: {gistId}
                    </Text>
                  </Box>
                </Box>

                {/* PAT Section */}
                <Box>
                  <HStack justify="space-between" align="center" mb={2}>
                    <Text fontSize="sm" color="gray.400">
                      Personal Access Token
                    </Text>
                    {!editingPat && (
                      <Button
                        variant="ghost"
                        size="xs"
                        color="purple.300"
                        _hover={{ color: 'purple.200' }}
                        onClick={() => {
                          setNewPat(pat || '')
                          setEditingPat(true)
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </HStack>

                  {editingPat ? (
                    <VStack gap={2} align="stretch">
                      <Box position="relative">
                        <Box
                          position="absolute"
                          left={3}
                          top="50%"
                          transform="translateY(-50%)"
                          color="gray.500"
                        >
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
                      <HStack gap={2}>
                        <Button
                          size="sm"
                          colorPalette="purple"
                          onClick={handleSavePat}
                          loading={isLoading}
                          flex={1}
                        >
                          <IconCheck size={16} />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingPat(false)
                            setNewPat(pat || '')
                          }}
                        >
                          Cancel
                        </Button>
                      </HStack>
                    </VStack>
                  ) : (
                    <Box
                      bg="gray.700"
                      borderRadius="md"
                      p={3}
                      borderWidth="1px"
                      borderColor="gray.600"
                    >
                      <Text fontSize="sm" color="gray.300" fontFamily="mono">
                        ••••••••••••••••
                      </Text>
                    </Box>
                  )}
                </Box>

                {/* Divider */}
                <Box borderTopWidth="1px" borderColor="gray.700" pt={4}>
                  <Heading size="sm" color="gray.400" mb={4}>
                    Account Actions
                  </Heading>

                  <VStack gap={3} align="stretch">
                    {/* Disconnect Button */}
                    <Button
                      variant="outline"
                      colorPalette="gray"
                      onClick={handleDisconnect}
                      justifyContent="flex-start"
                    >
                      <IconLogout size={18} />
                      Disconnect
                    </Button>
                    <Text fontSize="xs" color="gray.500" mt={-2}>
                      Sign out and clear local credentials. Your Gist data remains on GitHub.
                    </Text>

                    {/* Delete Gist Button */}
                    <Button
                      variant="outline"
                      colorPalette="red"
                      onClick={() => setShowDeleteConfirm(true)}
                      justifyContent="flex-start"
                    >
                      <IconTrash size={18} />
                      Delete Gist & Logout
                    </Button>
                    <Text fontSize="xs" color="gray.500" mt={-2}>
                      Permanently delete your Gist and all saved data. This cannot be undone.
                    </Text>
                  </VStack>
                </Box>
              </VStack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>

    {/* Delete Confirmation Dialog */}
    <Dialog.Root
      role="alertdialog"
      open={showDeleteConfirm}
      onOpenChange={(e) => setShowDeleteConfirm(e.open)}
      placement="center"
      size="sm"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="gray.800" borderColor="gray.700" borderWidth="1px">
            <Dialog.Header borderBottomWidth="1px" borderColor="gray.700">
              <Dialog.Title color="white">Delete Gist?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body py={4}>
              <Text color="gray.300">
                Are you sure you want to delete the Gist and all your data? This action cannot be undone.
              </Text>
            </Dialog.Body>
            <Dialog.Footer gap={3}>
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                colorPalette="red"
                onClick={handleDeleteGist}
                loading={isDeleting}
              >
                <IconTrash size={16} />
                Delete
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  </>
  )
}
