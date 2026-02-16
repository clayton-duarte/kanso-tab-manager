import {
  Box,
  Flex,
  Text,
  IconButton,
  Input,
  VStack,
  Image,
  Popover,
  Portal,
} from '@chakra-ui/react';
import {
  IconPlus,
  IconCheck,
  IconX,
  IconGripVertical,
  IconLink,
} from '@tabler/icons-react';
import { useState } from 'react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '@/features/store/useAppStore';
import { getTabDataFromChrome, extractTitleFromUrl } from '@/shared/utils/urlParser';
import { openOrFocusTab } from '@/shared/utils/chromeTabs';
import type { PinnedLink } from '@/features/github/types';
import { LinkEditPopover } from './LinkEditPopover';

interface SortablePinnedLinkItemProps {
  link: PinnedLink;
  accentColor: string;
  onSave: (updates: { title?: string; url?: string; favicon?: string }) => void;
  onDelete: () => void;
  onMoveToWorkspace: () => void;
}

function SortablePinnedLinkItem({
  link,
  accentColor,
  onSave,
  onDelete,
  onMoveToWorkspace,
}: SortablePinnedLinkItemProps) {
  const [faviconError, setFaviconError] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getFaviconDisplay = () => {
    // Only show stored favicon, no fallback
    return link.favicon || null;
  };

  const faviconUrl = getFaviconDisplay();

  const handleOpenLink = () => {
    openOrFocusTab(link.url);
  };

  return (
    <Flex
      ref={setNodeRef}
      style={style}
      align="center"
      gap={2}
      px={2}
      py={1.5}
      cursor="pointer"
      onClick={handleOpenLink}
    >
      <Box
        {...attributes}
        {...listeners}
        cursor="grab"
        color={`${accentColor}.border`}
        onClick={(e) => e.stopPropagation()}
      >
        <IconGripVertical size={14} />
      </Box>
      {faviconUrl && !faviconError ? (
        <Image
          src={faviconUrl}
          alt=""
          w={4}
          h={4}
          borderRadius="sm"
          onError={() => setFaviconError(true)}
        />
      ) : (
        <Box color="fg.muted">
          <IconLink size={14} />
        </Box>
      )}
      <Text fontSize="sm" flex={1} minW={0} lineClamp={1}>
        {link.title || link.url}
      </Text>
      <Box onClick={(e) => e.stopPropagation()}>
        <LinkEditPopover
          link={link}
          accentColor={accentColor}
          variant="pinned"
          onSave={onSave}
          onDelete={onDelete}
          onMove={onMoveToWorkspace}
        />
      </Box>
    </Flex>
  );
}

export function PinsArea() {
  const {
    activeProfileId,
    pinnedLinksCache,
    addPinnedLink,
    removePinnedLink,
    updatePinnedLink,
    reorderPinnedLinks,
    moveLinkToPinned,
    movePinnedToWorkspace,
    accentColor,
  } = useAppStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const pinnedLinks = activeProfileId
    ? pinnedLinksCache[activeProfileId] || []
    : [];

  // Handle external drops (bookmarks, links from other windows)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only accept URLs
    if (
      e.dataTransfer.types.includes('text/uri-list') ||
      e.dataTransfer.types.includes('text/html') ||
      e.dataTransfer.types.includes('text/plain') ||
      e.dataTransfer.types.includes('application/x-kanso-link')
    ) {
      e.dataTransfer.dropEffect = 'copy';
      if (!isDragOver) setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Check if it's a kanso workspace link (move from workspace to pins)
    const kansoLinkData = e.dataTransfer.getData('application/x-kanso-link');
    if (kansoLinkData) {
      try {
        const linkData = JSON.parse(kansoLinkData);
        if (linkData.id) {
          // Move from workspace to pins (removes from workspace)
          moveLinkToPinned(linkData.id);
          return;
        }
      } catch {
        // Invalid JSON - fall through to URL handling
      }
    }

    // Try to get URL from various data types (external drops)
    const url =
      e.dataTransfer.getData('text/uri-list') ||
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('URL');

    if (url && url.startsWith('http')) {
      try {
        // Get title and favicon from Chrome tabs (if tab is open)
        const tabData = await getTabDataFromChrome(url);
        
        // Use Chrome tab data if available, otherwise fallback
        const title = tabData.title || extractTitleFromUrl(url);
        const favicon = tabData.favicon || undefined;
        
        // Add pinned link with title and favicon from Chrome (or fallbacks)
        addPinnedLink(url, title, favicon);
      } catch {
        // Invalid URL - ignore
      }
    }
  };

  const handleCreateLink = async () => {
    if (newUrl.trim()) {
      try {
        const url = newUrl.trim().startsWith('http')
          ? newUrl.trim()
          : `https://${newUrl.trim()}`;
        
        // Get title and favicon from Chrome tabs (if tab is open)
        const tabData = await getTabDataFromChrome(url);
        
        // Use Chrome tab data if available, otherwise fallback
        const title = tabData.title || extractTitleFromUrl(url);
        const favicon = tabData.favicon || undefined;
        
        // Add pinned link with title and favicon from Chrome (or fallbacks)
        addPinnedLink(url, title, favicon);
        setNewUrl('');
        setCreateOpen(false);
      } catch {
        setNewUrl('');
        setCreateOpen(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateLink();
    } else if (e.key === 'Escape') {
      setCreateOpen(false);
      setNewUrl('');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pinnedLinks.findIndex((l) => l.id === active.id);
      const newIndex = pinnedLinks.findIndex((l) => l.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderPinnedLinks(oldIndex, newIndex);
      }
    }
  };

  const linkIds = pinnedLinks.map((l) => l.id);

  return (
    <Box
      borderBottomWidth="1px"
      borderColor="border.muted"
      position="relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <Flex
          position="absolute"
          inset={0}
          bg={`${accentColor}.900/30`}
          borderWidth="2px"
          borderStyle="dashed"
          borderColor={`${accentColor}.500`}
          borderRadius="md"
          zIndex={10}
          align="center"
          justify="center"
          direction="column"
          gap={1}
          pointerEvents="none"
        >
          <IconLink
            size={20}
            color={`var(--chakra-colors-${accentColor}-400)`}
          />
          <Text color={`${accentColor}.400`} fontWeight="medium" fontSize="xs">
            Drop to pin
          </Text>
        </Flex>
      )}

      <Flex
        justify="space-between"
        align="center"
        px={4}
        py={3}
        borderBottomWidth="1px"
        borderColor="border.muted"
      >
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
        >
          Pins
        </Text>
        <Popover.Root
          open={createOpen}
          onOpenChange={(e) => {
            setCreateOpen(e.open);
            if (!e.open) setNewUrl('');
          }}
          positioning={{ placement: 'bottom-end' }}
        >
          <Popover.Trigger asChild>
            <IconButton
              aria-label="Add pin"
              size="xs"
              variant="ghost"
              colorPalette={accentColor}
            >
              <IconPlus size={14} />
            </IconButton>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content w="200px">
                <Popover.Body p={3}>
                  <VStack gap={3} align="stretch">
                    <Box>
                      <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb={1}>
                        URL
                      </Text>
                      <Input
                        size="sm"
                        placeholder="URL"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        variant="outline"
                      />
                    </Box>
                    <Flex justify="flex-end" gap={1}>
                      <IconButton
                        aria-label="Cancel"
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setCreateOpen(false);
                          setNewUrl('');
                        }}
                      >
                        <IconX size={14} />
                      </IconButton>
                      <IconButton
                        aria-label="Create"
                        size="xs"
                        variant="solid"
                        colorPalette={accentColor}
                        onClick={handleCreateLink}
                      >
                        <IconCheck size={14} />
                      </IconButton>
                    </Flex>
                  </VStack>
                </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      </Flex>

      <Box minH="40px">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={linkIds}
            strategy={verticalListSortingStrategy}
          >
            {pinnedLinks.map((link) => (
              <SortablePinnedLinkItem
                key={link.id}
                link={link}
                accentColor={accentColor}
                onSave={(updates) => updatePinnedLink(link.id, updates)}
                onDelete={() => removePinnedLink(link.id)}
                onMoveToWorkspace={() => movePinnedToWorkspace(link.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {pinnedLinks.length === 0 && !isDragOver && (
          <Text
            fontSize="xs"
            color="fg.subtle"
            px={3}
            py={2}
            textAlign="center"
          >
            No pinned links
          </Text>
        )}
      </Box>
    </Box>
  );
}
