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
  Dialog,
  Button,
} from '@chakra-ui/react';
import {
  IconChevronDown,
  IconCheck,
  IconX,
  IconTrash,
  IconPin,
  IconArrowRight,
  IconLink,
} from '@tabler/icons-react';
import { useState, useEffect } from 'react';

interface LinkData {
  id: string;
  url: string;
  title: string;
  favicon?: string;
}

interface LinkEditPopoverProps {
  link: LinkData;
  accentColor: string;
  variant: 'workspace' | 'pinned';
  onSave: (updates: { title?: string; url?: string; favicon?: string }) => void;
  onDelete: () => void;
  onMove: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function LinkEditPopover({
  link,
  accentColor,
  variant,
  onSave,
  onDelete,
  onMove,
  onOpenChange,
}: LinkEditPopoverProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [customFavicon, setCustomFavicon] = useState(link.favicon || '');
  const [faviconError, setFaviconError] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Reset form when popover opens
  useEffect(() => {
    if (open) {
      setTitle(link.title);
      setUrl(link.url);
      // Show stored favicon only
      setCustomFavicon(link.favicon || '');
      setFaviconError(false);
    }
  }, [open, link.title, link.url, link.favicon]);

  // Current favicon for preview (use input value)
  const currentFavicon = customFavicon || null;

  // When URL changes, just update the URL (don't auto-derive favicon)
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
  };

  const handleSave = () => {
    const updates: { title?: string; url?: string; favicon?: string } = {};

    if (title.trim() !== link.title) {
      updates.title = title.trim();
    }
    if (url.trim() !== link.url) {
      updates.url = url.trim();
    }
    // Save favicon if changed
    if (customFavicon !== (link.favicon || '')) {
      updates.favicon = customFavicon || undefined;
    }

    if (Object.keys(updates).length > 0) {
      onSave(updates);
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    onDelete();
    setDeleteConfirmOpen(false);
    setOpen(false);
  };

  const handleMove = () => {
    onMove();
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <>
    <Popover.Root
      open={open}
      onOpenChange={(e) => {
        setOpen(e.open);
        onOpenChange?.(e.open);
      }}
      positioning={{ placement: 'bottom-end' }}
    >
      <Popover.Trigger asChild>
        <IconButton
          aria-label="Edit link"
          size="xs"
          variant="ghost"
          colorPalette={accentColor}
          onClick={(e) => e.stopPropagation()}
        >
          <IconChevronDown size={14} />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            w="280px"
            onClick={(e) => e.stopPropagation()}
          >
            <Popover.Body p={3}>
              <VStack gap={3} align="stretch">
                {/* Favicon preview */}
                <Flex align="center" gap={2}>
                  {currentFavicon && !faviconError ? (
                    <Image
                      src={currentFavicon}
                      alt=""
                      w={5}
                      h={5}
                      borderRadius="sm"
                      onError={() => setFaviconError(true)}
                    />
                  ) : (
                    <Box color="fg.muted">
                      <IconLink size={20} />
                    </Box>
                  )}
                  <Text fontSize="xs" color="fg.muted" flex={1} lineClamp={1}>
                    {link.url}
                  </Text>
                </Flex>

                {/* Name input */}
                <Box>
                  <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb={1}>
                    Name
                  </Text>
                  <Input
                    size="sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Link name"
                    variant="outline"
                    onKeyDown={handleKeyDown}
                  />
                </Box>

                {/* URL input */}
                <Box>
                  <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb={1}>
                    URL
                  </Text>
                  <Input
                    size="sm"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://..."
                    variant="outline"
                    onKeyDown={handleKeyDown}
                  />
                </Box>

                {/* Favicon URL */}
                <Box>
                  <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb={1}>
                    Favicon URL
                  </Text>
                  <Input
                    size="sm"
                    value={customFavicon}
                    onChange={(e) => setCustomFavicon(e.target.value)}
                    placeholder="Leave empty for auto-detect"
                    variant="outline"
                    onKeyDown={handleKeyDown}
                  />
                </Box>

                {/* Action buttons */}
                <Flex justify="space-between" pt={2}>
                  <Flex gap={1}>
                    <IconButton
                      aria-label={variant === 'workspace' ? 'Move to Pins' : 'Move to Workspace'}
                      size="xs"
                      variant="ghost"
                      colorPalette={accentColor}
                      onClick={handleMove}
                      title={variant === 'workspace' ? 'Move to Pins' : 'Move to Workspace'}
                    >
                      {variant === 'workspace' ? <IconPin size={14} /> : <IconArrowRight size={14} />}
                    </IconButton>
                    <IconButton
                      aria-label="Delete"
                      size="xs"
                      variant="ghost"
                      colorPalette="red"
                      onClick={handleDelete}
                      title="Delete"
                    >
                      <IconTrash size={14} />
                    </IconButton>
                  </Flex>
                  <Flex gap={1}>
                    <IconButton
                      aria-label="Cancel"
                      size="xs"
                      variant="ghost"
                      onClick={handleCancel}
                    >
                      <IconX size={14} />
                    </IconButton>
                    <IconButton
                      aria-label="Save"
                      size="xs"
                      variant="solid"
                      colorPalette={accentColor}
                      onClick={handleSave}
                    >
                      <IconCheck size={14} />
                    </IconButton>
                  </Flex>
                </Flex>
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root
        open={deleteConfirmOpen}
        onOpenChange={(e) => setDeleteConfirmOpen(e.open)}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Delete Link?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text color="fg.muted">
                  Are you sure you want to delete this link? This action cannot
                  be undone.
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Flex gap={2}>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirmOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="solid"
                    colorPalette="red"
                    onClick={confirmDelete}
                  >
                    Delete
                  </Button>
                </Flex>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
