import {
  Box,
  Flex,
  Text,
  IconButton,
  Input,
  HStack,
  Image,
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
import { fetchPageTitle, getFaviconFromChrome } from '@/shared/utils/urlParser';
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
    // Use stored favicon if available, otherwise derive from URL
    if (link.favicon) {
      return link.favicon;
    }
    try {
      const urlObj = new URL(link.url);
      // DuckDuckGo's favicon service is more reliable than Google's
      return `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconDisplay();

  const handleOpenLink = () => {
    window.location.href = link.url;
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
      <Text fontSize="sm" flex={1} lineClamp={1}>
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

  const [isCreating, setIsCreating] = useState(false);
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
        const urlObj = new URL(url);
        // Try to get title from text/html if available
        const html = e.dataTransfer.getData('text/html');
        let title = urlObj.hostname;
        if (html) {
          const match = html.match(/<a[^>]*>([^<]+)<\/a>/i);
          if (match && match[1]) {
            title = match[1];
          }
        }
        // Get favicon from Chrome (actual cached favicon)
        const favicon = await getFaviconFromChrome(url);
        const linkId = addPinnedLink(url, title, favicon);
        
        // Fetch actual page title and update
        if (linkId) {
          fetchPageTitle(url).then((fetchedTitle) => {
            if (fetchedTitle !== title) {
              updatePinnedLink(linkId, { title: fetchedTitle });
            }
          });
        }
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
        const urlObj = new URL(url);
        // Get favicon from Chrome (actual cached favicon)
        const favicon = await getFaviconFromChrome(url);
        const linkId = addPinnedLink(url, urlObj.hostname, favicon);
        setNewUrl('');
        setIsCreating(false);

        // Fetch actual page title and update
        if (linkId) {
          fetchPageTitle(url).then((fetchedTitle) => {
            if (fetchedTitle !== urlObj.hostname) {
              updatePinnedLink(linkId, { title: fetchedTitle });
            }
          });
        }
      } catch {
        setNewUrl('');
        setIsCreating(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateLink();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
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
        <IconButton
          aria-label="Add pin"
          size="xs"
          variant="ghost"
          colorPalette={accentColor}
          onClick={() => setIsCreating(true)}
        >
          <IconPlus size={14} />
        </IconButton>
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

        {isCreating && (
          <HStack gap={1} px={2} py={1}>
            <Input
              size="sm"
              placeholder="URL"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              variant="outline"
            />
            <IconButton
              aria-label="Confirm"
              size="xs"
              variant="ghost"
              colorPalette={accentColor}
              onClick={handleCreateLink}
            >
              <IconCheck size={14} />
            </IconButton>
            <IconButton
              aria-label="Cancel"
              size="xs"
              variant="ghost"
              colorPalette={accentColor}
              onClick={() => {
                setIsCreating(false);
                setNewUrl('');
              }}
            >
              <IconX size={14} />
            </IconButton>
          </HStack>
        )}

        {pinnedLinks.length === 0 && !isCreating && !isDragOver && (
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
