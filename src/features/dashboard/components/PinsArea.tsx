import {
  Box,
  Flex,
  Text,
  IconButton,
  Input,
  HStack,
  Menu,
  Portal,
  Image,
} from '@chakra-ui/react';
import {
  IconPlus,
  IconCheck,
  IconX,
  IconTrash,
  IconPencil,
  IconGripVertical,
  IconChevronDown,
  IconPin,
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
import type { PinnedLink } from '@/features/github/types';

interface SortablePinnedLinkItemProps {
  link: PinnedLink;
  accentColor: string;
  onStartRename: () => void;
  onDelete: () => void;
}

function SortablePinnedLinkItem({
  link,
  accentColor,
  onStartRename,
  onDelete,
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

  const getFaviconUrl = () => {
    try {
      const urlObj = new URL(link.url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl();

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
          <IconPin size={14} />
        </Box>
      )}
      <Text fontSize="sm" flex={1} lineClamp={1}>
        {link.title || link.url}
      </Text>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            aria-label="Pin menu"
            size="xs"
            variant="ghost"
            colorPalette={accentColor}
            onClick={(e) => e.stopPropagation()}
          >
            <IconChevronDown size={14} />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item value="edit" onClick={onStartRename}>
                <IconPencil size={14} />
                Edit
              </Menu.Item>
              <Menu.Item value="delete" color="fg.error" onClick={onDelete}>
                <IconTrash size={14} />
                Delete
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
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
    accentColor,
  } = useAppStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingUrl, setEditingUrl] = useState('');

  const pinnedLinks = activeProfileId
    ? pinnedLinksCache[activeProfileId] || []
    : [];

  const handleCreateLink = async () => {
    if (newUrl.trim()) {
      try {
        const url = newUrl.trim().startsWith('http')
          ? newUrl.trim()
          : `https://${newUrl.trim()}`;
        const urlObj = new URL(url);
        addPinnedLink(url, urlObj.hostname);
        setNewUrl('');
        setIsCreating(false);
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

  const handleStartRename = (link: PinnedLink) => {
    setEditingLinkId(link.id);
    setEditingTitle(link.title);
    setEditingUrl(link.url);
  };

  const handleSaveEdit = () => {
    if (editingLinkId && editingTitle.trim() && editingUrl.trim()) {
      updatePinnedLink(editingLinkId, {
        title: editingTitle.trim(),
        url: editingUrl.trim(),
      });
    }
    setEditingLinkId(null);
    setEditingTitle('');
    setEditingUrl('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingLinkId(null);
      setEditingTitle('');
      setEditingUrl('');
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
    <Box borderBottomWidth="1px" borderColor="border.muted">
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

      <Box>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={linkIds}
            strategy={verticalListSortingStrategy}
          >
            {pinnedLinks.map((link) =>
              editingLinkId === link.id ? (
                <Box key={link.id} px={2} py={1}>
                  <Input
                    size="sm"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    placeholder="Title"
                    mb={1}
                    variant="outline"
                  />
                  <HStack gap={1}>
                    <Input
                      size="sm"
                      value={editingUrl}
                      onChange={(e) => setEditingUrl(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      placeholder="URL"
                      autoFocus
                      variant="outline"
                    />
                    <IconButton
                      aria-label="Confirm"
                      size="xs"
                      colorPalette={accentColor}
                      onClick={handleSaveEdit}
                    >
                      <IconCheck size={14} />
                    </IconButton>
                    <IconButton
                      aria-label="Cancel"
                      size="xs"
                      variant="ghost"
                      colorPalette={accentColor}
                      onClick={() => {
                        setEditingLinkId(null);
                        setEditingTitle('');
                        setEditingUrl('');
                      }}
                    >
                      <IconX size={14} />
                    </IconButton>
                  </HStack>
                </Box>
              ) : (
                <SortablePinnedLinkItem
                  key={link.id}
                  link={link}
                  accentColor={accentColor}
                  onStartRename={() => handleStartRename(link)}
                  onDelete={() => removePinnedLink(link.id)}
                />
              )
            )}
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

        {pinnedLinks.length === 0 && !isCreating && (
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
