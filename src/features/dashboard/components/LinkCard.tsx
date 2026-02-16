import {
  Box,
  Flex,
  Text,
  Image,
  Card,
} from '@chakra-ui/react';
import { IconGripVertical } from '@tabler/icons-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { LinkItem } from '@/features/github/types';
import { useAppStore } from '@/features/store/useAppStore';
import { LinkEditPopover } from './LinkEditPopover';

interface LinkCardProps {
  link: LinkItem;
}

export function LinkCard({ link }: LinkCardProps) {
  const { removeLink, updateLink, accentColor, moveLinkToPinned } = useAppStore();
  const [faviconError, setFaviconError] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

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

  const handleOpenLink = () => {
    if (popoverOpen) return;
    window.location.href = link.url;
  };

  // Native drag for external drops (to pins area)
  const handleNativeDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/uri-list', link.url);
    e.dataTransfer.setData('text/plain', link.url);
    e.dataTransfer.setData('text/html', `<a href="${link.url}">${link.title}</a>`);
    e.dataTransfer.setData('application/x-kanso-link', JSON.stringify({
      id: link.id,
      url: link.url,
      title: link.title,
      favicon: link.favicon,
    }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  // Get favicon URL - only show stored favicon, no fallback
  const getFaviconDisplay = () => {
    return link.favicon || null;
  };

  const faviconUrl = getFaviconDisplay();
  const showFavicon = faviconUrl && !faviconError;

  const handleSave = (updates: { title?: string; url?: string; favicon?: string }) => {
    updateLink(link.id, updates);
  };

  const handleDelete = () => {
    removeLink(link.id);
  };

  const handleMove = () => {
    moveLinkToPinned(link.id);
  };

  return (
    <Card.Root
      ref={setNodeRef}
      style={style}
      size="sm"
      variant="subtle"
      cursor="pointer"
      onClick={handleOpenLink}
    >
      <Card.Body p={0}>
        <Flex align="center" gap={2} px={2}>
          {/* Drag handle for reordering (dnd-kit) */}
          <Box
            {...attributes}
            {...listeners}
            cursor="grab"
            color="fg.muted"
            onClick={(e) => e.stopPropagation()}
            flexShrink={0}
            alignSelf="stretch"
            display="flex"
            alignItems="center"
          >
            <IconGripVertical size={16} />
          </Box>

          {/* Content area - draggable to pins (native HTML5 drag) */}
          <Flex
            flex={1}
            align="center"
            draggable="true"
            onDragStart={handleNativeDragStart}
            onPointerDown={(e) => e.stopPropagation()}
            cursor="grab"
            data-no-dnd="true"
            gap={2}
          >
            {/* Favicon area */}
            {showFavicon && (
              <Box
                flexShrink={0}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Image
                  src={faviconUrl}
                  alt=""
                  boxSize="24px"
                  onError={() => setFaviconError(true)}
                />
              </Box>
            )}

            {/* Contents */}
            <Flex direction="column" flex={1} py={2} gap={0} minW={0}>
              <Text fontSize="sm" fontWeight="medium" lineClamp={1}>
                {link.title}
              </Text>
              <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                {link.url}
              </Text>
            </Flex>
          </Flex>

          {/* Popover Menu */}
          <Box flexShrink={0} onClick={(e) => e.stopPropagation()}>
            <LinkEditPopover
              link={link}
              accentColor={accentColor}
              variant="workspace"
              onSave={handleSave}
              onDelete={handleDelete}
              onMove={handleMove}
              onOpenChange={setPopoverOpen}
            />
          </Box>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}
