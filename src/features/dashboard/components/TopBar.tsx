import { 
  Box, 
  Flex, 
  Tabs,
  IconButton, 
  Text,
  Input,
  HStack,
} from '@chakra-ui/react'
import { 
  IconPlus, 
  IconSettings,
  IconCheck,
  IconX,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useAppStore } from '@/features/store/useAppStore'

interface TopBarProps {
  onOpenSettings: () => void
}

export function TopBar({ onOpenSettings }: TopBarProps) {
  const { profiles, activeProfileId, switchProfile, createProfile, isSaving, accentColor } = useAppStore()
  const [isCreating, setIsCreating] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')

  const handleCreateProfile = () => {
    if (newProfileName.trim()) {
      createProfile(newProfileName.trim())
      setNewProfileName('')
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateProfile()
    } else if (e.key === 'Escape') {
      setIsCreating(false)
      setNewProfileName('')
    }
  }

  return (
    <Box 
      as="header" 
      bg="gray.900" 
      borderBottomWidth="1px" 
      borderColor="gray.700"
      px={4}
      py={2}
    >
      <Flex justify="space-between" align="center">
        <HStack gap={4}>
          <Text 
            fontSize="lg" 
            fontWeight="bold" 
            color={`${accentColor}.400`}
            letterSpacing="tight"
          >
            Kanso
          </Text>

          <Tabs.Root
            value={activeProfileId || ''}
            onValueChange={(details) => switchProfile(details.value)}
            variant="line"
            size="sm"
            colorPalette={accentColor}
          >
            <Tabs.List bg="transparent" borderBottomWidth={0}>
              {profiles.map(profile => (
                <Tabs.Trigger
                  key={profile.id}
                  value={profile.id}
                  px={3}
                  py={1.5}
                  fontSize="sm"
                >
                  {profile.name}
                </Tabs.Trigger>
              ))}

              {isCreating ? (
                <HStack gap={1} ml={2}>
                  <Input
                    size="sm"
                    placeholder="Profile name"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    width="120px"
                    variant="outline"
                  />
                  <IconButton
                    aria-label="Confirm"
                    size="xs"
                    variant="ghost"
                    colorPalette="green"
                    onClick={handleCreateProfile}
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
                      setNewProfileName('')
                    }}
                  >
                    <IconX size={14} />
                  </IconButton>
                </HStack>
              ) : (
                <IconButton
                  aria-label="Add profile"
                  size="xs"
                  variant="ghost"
                  colorPalette={accentColor}
                  ml={2}
                  onClick={() => setIsCreating(true)}
                >
                  <IconPlus size={16} />
                </IconButton>
              )}
            </Tabs.List>
          </Tabs.Root>
        </HStack>

        <HStack gap={2}>
          {isSaving && (
            <Text fontSize="xs" color="gray.500">
              Saving...
            </Text>
          )}
          <IconButton
            aria-label="Settings"
            variant="ghost"
            size="sm"
            colorPalette={accentColor}
            onClick={onOpenSettings}
          >
            <IconSettings size={20} />
          </IconButton>
        </HStack>
      </Flex>
    </Box>
  )
}
