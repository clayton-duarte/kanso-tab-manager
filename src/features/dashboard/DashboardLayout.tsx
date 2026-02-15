import {
  Box,
  Grid,
  GridItem,
  Text,
  Flex,
  VStack,
  IconButton,
  Input,
  HStack,
} from '@chakra-ui/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState, useEffect, useCallback } from 'react';
import { IconPlus, IconCheck, IconX } from '@tabler/icons-react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { LinkCard } from './components/LinkCard';
import { DropZone } from './components/DropZone';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SyncStatusBanner } from './components/SyncStatusBanner';
import {
  useAppStore,
  selectActiveWorkspaceData,
} from '@/features/store/useAppStore';
import {
  isValidUrl,
  extractTitleFromUrl,
  getFaviconUrl,
  fetchPageTitle,
} from '@/shared/utils/urlParser';

export function DashboardLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const activeWorkspaceData = useAppStore(selectActiveWorkspaceData);
  const reorderLinks = useAppStore((state) => state.reorderLinks);
  const addLink = useAppStore((state) => state.addLink);
  const updateLink = useAppStore((state) => state.updateLink);
  const accentColor = useAppStore((state) => state.accentColor);

  // Handle adding a link
  const handleAddLink = useCallback(
    (url: string) => {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) return;

      // Add https:// if no protocol
      const fullUrl = trimmedUrl.match(/^https?:\/\//)
        ? trimmedUrl
        : `https://${trimmedUrl}`;

      if (!isValidUrl(fullUrl)) return;

      const title = extractTitleFromUrl(fullUrl);
      const favicon = getFaviconUrl(fullUrl);
      const linkId = addLink(fullUrl, title, favicon);

      // Fetch actual title in background
      if (linkId) {
        fetchPageTitle(fullUrl).then((fetchedTitle) => {
          if (fetchedTitle !== title) {
            updateLink(linkId, { title: fetchedTitle });
          }
        });
      }

      setNewLinkUrl('');
      setIsAddingLink(false);
    },
    [addLink, updateLink]
  );

  // Handle paste event globally
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't capture paste if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (text && isValidUrl(text)) {
        e.preventDefault();
        handleAddLink(text);
      } else if (text) {
        // Try adding https:// prefix
        const withProtocol = `https://${text}`;
        if (isValidUrl(withProtocol)) {
          e.preventDefault();
          handleAddLink(text);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleAddLink]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddLink(newLinkUrl);
    } else if (e.key === 'Escape') {
      setIsAddingLink(false);
      setNewLinkUrl('');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && activeWorkspaceData) {
      const oldIndex = activeWorkspaceData.links.findIndex(
        (l) => l.id === active.id
      );
      const newIndex = activeWorkspaceData.links.findIndex(
        (l) => l.id === over.id
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderLinks(oldIndex, newIndex);
      }
    }
  };

  const links = activeWorkspaceData?.links || [];
  const linkIds = links.map((l) => l.id);

  return (
    <Grid
      templateColumns="auto 1fr"
      templateRows="auto auto 1fr"
      bg="gray.900"
      h="100vh"
    >
      {/* Top Bar - spans full width */}
      <GridItem colSpan={2}>
        <TopBar onOpenSettings={() => setSettingsOpen(true)} />
      </GridItem>

      {/* Sync Status Banner - non-blocking warning for sync errors */}
      <GridItem colSpan={2}>
        <SyncStatusBanner />
      </GridItem>

      {/* Sidebar */}
      <GridItem>
        <Sidebar />
      </GridItem>

      {/* Main Content */}
      <GridItem overflow="auto">
        <DropZone>
          {activeWorkspaceData && (
            <Box maxW="700px" mx="auto" p={6}>
              <Flex justify="space-between" align="center" mb={4}>
                <Text fontSize="xl" fontWeight="bold" color="white">
                  {activeWorkspaceData.name}
                </Text>
                <HStack gap={2}>
                  <Text fontSize="sm" color="gray.500">
                    {links.length} {links.length === 1 ? 'link' : 'links'}
                  </Text>
                  <IconButton
                    aria-label="Add link"
                    size="xs"
                    variant="ghost"
                    colorPalette={accentColor}
                    onClick={() => setIsAddingLink(true)}
                  >
                    <IconPlus size={16} />
                  </IconButton>
                </HStack>
              </Flex>

              {/* Add link form */}
              {isAddingLink && (
                <HStack gap={2} mb={4}>
                  <Input
                    placeholder="Paste or type URL..."
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    size="sm"
                    variant="outline"
                    flex={1}
                  />
                  <IconButton
                    aria-label="Add"
                    size="sm"
                    variant="solid"
                    colorPalette={accentColor}
                    onClick={() => handleAddLink(newLinkUrl)}
                  >
                    <IconCheck size={16} />
                  </IconButton>
                  <IconButton
                    aria-label="Cancel"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingLink(false);
                      setNewLinkUrl('');
                    }}
                  >
                    <IconX size={16} />
                  </IconButton>
                </HStack>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={linkIds}
                  strategy={verticalListSortingStrategy}
                >
                  <VStack gap={3} align="stretch">
                    {links.map((link) => (
                      <LinkCard key={link.id} link={link} />
                    ))}
                  </VStack>
                </SortableContext>
              </DndContext>
            </Box>
          )}
        </DropZone>
      </GridItem>

      {/* Settings Drawer */}
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Grid>
  );
}
