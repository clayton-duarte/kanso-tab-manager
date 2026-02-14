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
  IconButton,
  Link,
  Dialog,
} from '@chakra-ui/react'
import {
  IconLogout,
  IconKey,
  IconExternalLink,
  IconTrash,
  IconCheck,
  IconPalette,
  IconX,
  IconEyeOff,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useAppStore } from '@/features/store/useAppStore'
import type { AccentColor } from '@/features/store/types'

const ACCENT_COLORS: { value: AccentColor; label: string }[] = [
  { value: 'gray', label: 'Gray' },
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'teal', label: 'Teal' },
  { value: 'blue', label: 'Blue' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'purple', label: 'Purple' },
  { value: 'pink', label: 'Pink' },
]

interface SettingsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDrawer({ open, onOpenChange }: SettingsDrawerProps) {
  const {
    pat,
    gistId,
    accentColor,
    setCredentials,
    clearCredentials,
    deleteGistAndLogout,
    setAccentColor,
    isSyncing,
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
                <IconButton
                  aria-label="Close settings"
                  size="sm"
            variant="ghost"
                  colorPalette={accentColor}
                >
                  <IconX size={18} />
                </IconButton>
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
                        colorPalette={accentColor}
                        fontSize="sm"
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
                        variant="outline"
                        size="xs"
                        colorPalette={accentColor}
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
                          variant="outline"
                        />
                      </Box>
                      <HStack gap={2}>
                        <Button
                          size="sm"
                          colorPalette={accentColor}
                          onClick={handleSavePat}
                          loading={isSyncing}
                          flex={1}
                        >
                          <IconCheck size={16} />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          colorPalette={accentColor}
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

                {/* Accent Color Section */}
                <Box>
                  <HStack mb={2}>
                    <IconPalette size={16} color="#9CA3AF" />
                    <Text fontSize="sm" color="gray.400">
                      Accent Color
                    </Text>
                  </HStack>
                  <HStack gap={1} justifyContent="space-between">
                    {ACCENT_COLORS.map(({ value, label }) => (
                      <Box
                        key={value}
                        as="button"
                        title={label}
                        w={8}
                        h={8}
                        borderRadius="md"
                        bg={`${value}.500`}
                        borderWidth="2px"
                        borderColor={accentColor === value ? 'white' : 'transparent'}
                        onClick={() => setAccentColor(value)}
                        cursor="pointer"
                      />
                    ))}
                  </HStack>
                </Box>

                {/* Hide Chrome Footer Tip */}
                <Box borderTopWidth="1px" borderColor="gray.700" pt={4}>
                  <HStack mb={2}>
                    <IconEyeOff size={16} color="#9CA3AF" />
                    <Text fontSize="sm" color="gray.400">
                      Hide Chrome Footer
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    Right-click the footer at the bottom of the New Tab page and select "Hide footer on New Tab page" to remove Chrome's customize button.
                  </Text>
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
                      colorPalette={accentColor}
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
                      colorPalette={accentColor}
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
                colorPalette={accentColor}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                colorPalette={accentColor}
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
