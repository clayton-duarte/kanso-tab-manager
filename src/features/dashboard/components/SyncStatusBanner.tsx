import { Alert, IconButton, HStack, Text } from '@chakra-ui/react'
import { IconX, IconCloudOff, IconRefresh } from '@tabler/icons-react'
import { useAppStore } from '@/features/store/useAppStore'

/**
 * Non-blocking sync status banner
 * Shows sync errors as warnings without blocking the UI
 */
export function SyncStatusBanner() {
  const syncError = useAppStore(state => state.syncError)
  const isSyncing = useAppStore(state => state.isSyncing)
  const clearSyncError = useAppStore(state => state.clearSyncError)
  const sync = useAppStore(state => state.sync)
  const accentColor = useAppStore(state => state.accentColor)

  // Don't show anything if no error and not syncing
  if (!syncError && !isSyncing) {
    return null
  }

  // Show subtle syncing indicator (optional - can remove if too noisy)
  if (isSyncing && !syncError) {
    return null // Don't show anything while syncing - keep it invisible
  }

  // Show error banner
  if (syncError) {
    return (
      <Alert.Root
        status="warning"
        size="sm"
        py={2}
        px={4}
        borderRadius={0}
        bg="yellow.900/30"
        borderBottomWidth="1px"
        borderBottomColor="yellow.800/50"
      >
        <HStack justify="space-between" w="100%">
          <HStack gap={2}>
            <IconCloudOff size={16} />
            <Text fontSize="sm" color="yellow.200">
              {syncError}
            </Text>
          </HStack>
          <HStack gap={1}>
            <IconButton
              aria-label="Retry sync"
              size="xs"
              variant="ghost"
              colorPalette={accentColor}
              onClick={() => sync()}
            >
              <IconRefresh size={14} />
            </IconButton>
            <IconButton
              aria-label="Dismiss"
              size="xs"
              variant="ghost"
              onClick={clearSyncError}
            >
              <IconX size={14} />
            </IconButton>
          </HStack>
        </HStack>
      </Alert.Root>
    )
  }

  return null
}
