import {
  Box,
  Flex,
  Text,
  IconButton,
  Image,
  Card,
  Menu,
  Portal,
  Input,
  VStack,
} from '@chakra-ui/react';
import {
  IconTrash,
  IconGripVertical,
  IconChevronDown,
  IconPencil,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { LinkItem } from '@/features/github/types';
import { useAppStore } from '@/features/store/useAppStore';

interface LinkCardProps {
  link: LinkItem;
}

export function LinkCard({ link }: LinkCardProps) {
  const { removeLink, updateLink, accentColor } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(link.title);
  const [editUrl, setEditUrl] = useState(link.url);
  const [faviconError, setFaviconError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    if (menuOpen) return;
    window.location.href = link.url;
  };

  const handleDelete = () => {
    removeLink(link.id);
  };

  const handleStartEdit = () => {
    setEditTitle(link.title);
    setEditUrl(link.url);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editTitle.trim() && editUrl.trim()) {
      updateLink(link.id, {
        title: editTitle.trim(),
        url: editUrl.trim(),
      });
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(link.title);
    setEditUrl(link.url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Extract favicon URL using Google's service
  const faviconUrl = (() => {
    try {
      const domain = new URL(link.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  })();

  const showFavicon = faviconUrl && !faviconError;

  if (isEditing) {
    return (
      <Card.Root ref={setNodeRef} style={style} size="sm" variant="outline">
        <Card.Body p={3}>
          <VStack gap={2} align="stretch">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              size="sm"
              variant="outline"
              autoFocus
              onKeyDown={handleKeyDown}
            />
            <Input
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="URL"
              size="sm"
              variant="outline"
              onKeyDown={handleKeyDown}
            />
            <Flex justify="flex-end" gap={1}>
              <IconButton
                aria-label="Cancel"
                size="xs"
                variant="ghost"
                onClick={handleCancelEdit}
              >
                <IconX size={14} />
              </IconButton>
              <IconButton
                aria-label="Save"
                size="xs"
                variant="solid"
                colorPalette={accentColor}
                onClick={handleSaveEdit}
              >
                <IconCheck size={14} />
              </IconButton>
            </Flex>
          </VStack>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root
      ref={setNodeRef}
      style={style}
      size="sm"
      variant="outline"
      cursor="pointer"
      onClick={handleOpenLink}
    >
      <Card.Body p={0}>
        <Flex>
          {/* Favicon area */}
          {showFavicon && (
            <Box
              flexShrink={0}
              w="60px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRightWidth="1px"
              borderColor="border.subtle"
            >
              <Image
                src={faviconUrl}
                alt=""
                boxSize="32px"
                onError={() => setFaviconError(true)}
              />
            </Box>
          )}

          {/* Contents */}
          <Flex direction="column" flex={1} p={3} gap={1} minW={0}>
            {/* Top row: drag | name | menu */}
            <Flex align="center" gap={2}>
              <Box
                {...attributes}
                {...listeners}
                cursor="grab"
                color="fg.muted"
                onClick={(e) => e.stopPropagation()}
                flexShrink={0}
              >
                <IconGripVertical size={16} />
              </Box>
              <Text fontSize="sm" fontWeight="medium" lineClamp={1} flex={1}>
                {link.title}
              </Text>
              <Menu.Root open={menuOpen} onOpenChange={(e) => setMenuOpen(e.open)}>
                <Menu.Trigger asChild>
                  <IconButton
                    aria-label="Link menu"
                    size="xs"
                    variant="ghost"
                    colorPalette={accentColor}
                    onClick={(e) => e.stopPropagation()}
                    flexShrink={0}
                  >
                    <IconChevronDown size={14} />
                  </IconButton>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content onClick={(e) => e.stopPropagation()}>
                      <Menu.Item
                        value="edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit();
                        }}
                      >
                        <IconPencil size={14} />
                        Edit
                      </Menu.Item>
                      <Menu.Item
                        value="delete"
                        color="fg.error"
                        _hover={{ bg: 'bg.error', color: 'fg.error' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete();
                        }}
                      >
                        <IconTrash size={14} />
                        Delete
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            </Flex>

            {/* Bottom row: address */}
            <Text fontSize="xs" color="fg.muted" lineClamp={1}>
              {link.url}
            </Text>
          </Flex>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}
