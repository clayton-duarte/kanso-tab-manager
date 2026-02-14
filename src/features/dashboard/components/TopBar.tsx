import { 
  Box, 
  Flex, 
  Tabs,
  IconButton, 
  Text,
  Input,
  HStack,
  ProgressCircle,
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
  const { profiles, activeProfileId, switchProfile, createProfile, isSaving, isSyncing, accentColor } = useAppStore()
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
                    colorPalette={accentColor}
                    onClick={handleCreateProfile}
                  >
                    <IconCheck size={14} />
                  </IconButton>
                  <IconButton
                    aria-label="Cancel"
                    size="xs"
                    variant="ghost"
                    colorPalette={accentColor}
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
          {(isSaving || isSyncing) && (
            <ProgressCircle.Root value={null} size="xs" colorPalette={accentColor}>
              <ProgressCircle.Circle>
                <ProgressCircle.Track />
                <ProgressCircle.Range />
              </ProgressCircle.Circle>
            </ProgressCircle.Root>
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
