import {
  Box,
  VStack,
  Text,
  IconButton,
  Flex,
  Input,
  Popover,
  Portal,
  Checkbox,
  Dialog,
  Button,
} from '@chakra-ui/react';
import {
  IconPlus,
  IconCheck,
  IconX,
  IconTrash,
  IconGripVertical,
  IconChevronDown,
} from '@tabler/icons-react';
import { useState, useEffect } from 'react';
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
import type { WorkspaceMeta } from '@/features/github/types';
import { PinsArea } from './PinsArea';

interface SortableWorkspaceItemProps {
  workspace: WorkspaceMeta;
  isActive: boolean;
  accentColor: string;
  onSwitch: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

function SortableWorkspaceItem({
  workspace,
  isActive,
  accentColor,
  onSwitch,
  onRename,
  onDelete,
}: SortableWorkspaceItemProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(workspace.name);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Reset form when popover opens
  useEffect(() => {
    if (open) {
      setName(workspace.name);
    }
  }, [open, workspace.name]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workspace.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    if (name.trim() && name.trim() !== workspace.name) {
      onRename(name.trim());
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Flex
      ref={setNodeRef}
      style={style}
      align="center"
      gap={2}
      px={2}
      py={2}
      cursor="pointer"
      bg={isActive ? `${accentColor}.subtle` : 'transparent'}
      borderLeftWidth="2px"
      borderLeftColor={isActive ? `${accentColor}.border` : 'transparent'}
      onClick={onSwitch}
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
      <Text fontSize="sm" flex={1} minW={0} lineClamp={1}>
        {workspace.name}
      </Text>
      <Popover.Root
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        positioning={{ placement: 'bottom-end' }}
      >
        <Popover.Trigger asChild>
          <IconButton
            aria-label="Workspace menu"
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
              w="200px"
              onClick={(e) => e.stopPropagation()}
            >
              <Popover.Body p={3}>
                <VStack gap={3} align="stretch">
                  {/* Name input */}
                  <Box>
                    <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb={1}>
                      Name
                    </Text>
                    <Input
                      size="sm"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Workspace name"
                      variant="outline"
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                  </Box>

                  {/* Action buttons */}
                  <Flex justify="space-between" pt={2}>
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
                <Dialog.Title>Delete Workspace?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text color="fg.muted">
                  Are you sure you want to delete "{workspace.name}"? All links
                  in this workspace will be lost. This action cannot be undone.
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
    </Flex>
  );
}

export function Sidebar() {
  const {
    profiles,
    workspaces,
    activeProfileId,
    activeWorkspaceId,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    reorderWorkspaces,
    accentColor,
  } = useAppStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [useCurrentTabs, setUseCurrentTabs] = useState(false);

  // Get current profile name
  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // Filter workspaces for current profile
  const profileWorkspaces = workspaces.filter(
    (w) => w.profile === activeProfile?.name
  );

  const handleCreateWorkspace = async () => {
    if (newWorkspaceName.trim()) {
      const name = newWorkspaceName.trim();
      
      // Get current tabs if checkbox is checked (exclude pinned tabs)
      let initialLinks: Array<{ url: string; title: string; favicon?: string }> = [];
      if (useCurrentTabs && typeof chrome !== 'undefined' && chrome.tabs) {
        try {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          initialLinks = tabs
            .filter((tab) => tab.url && tab.url.startsWith('http') && !tab.pinned)
            .map((tab) => ({
              url: tab.url!,
              title: tab.title || tab.url!,
              favicon: tab.favIconUrl,
            }));
        } catch {
          // Silently ignore - create without tabs
        }
      }
      
      // Reset UI immediately (optimistic)
      setNewWorkspaceName('');
      setUseCurrentTabs(false);
      setCreateOpen(false);
      // Sync in background
      await createWorkspace(name, initialLinks.length > 0 ? initialLinks : undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateWorkspace();
    } else if (e.key === 'Escape') {
      setCreateOpen(false);
      setNewWorkspaceName('');
      setUseCurrentTabs(false);
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    await deleteWorkspace(workspaceId);
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
      const oldIndex = profileWorkspaces.findIndex((w) => w.id === active.id);
      const newIndex = profileWorkspaces.findIndex((w) => w.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderWorkspaces(oldIndex, newIndex);
      }
    }
  };

  const workspaceIds = profileWorkspaces.map((w) => w.id);

  return (
    <Box
      as="aside"
      bg="bg.subtle"
      borderRightWidth="1px"
      borderColor="border"
      w="240px"
      minW="240px"
      h="100%"
      overflowY="auto"
      overflowX="hidden"
    >
      <PinsArea />

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
          Workspaces
        </Text>
        <Popover.Root
          open={createOpen}
          onOpenChange={(e) => {
            setCreateOpen(e.open);
            if (!e.open) {
              setNewWorkspaceName('');
              setUseCurrentTabs(false);
            }
          }}
          positioning={{ placement: 'bottom-end' }}
        >
          <Popover.Trigger asChild>
            <IconButton
              aria-label="Add workspace"
              size="xs"
              variant="ghost"
              colorPalette={accentColor}
            >
              <IconPlus size={14} />
            </IconButton>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content w="220px">
                <Popover.Body p={3}>
                  <VStack gap={3} align="stretch">
                    <Box>
                      <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb={1}>
                        Name
                      </Text>
                      <Input
                        size="sm"
                        placeholder="Workspace name"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        variant="outline"
                      />
                    </Box>
                    <Checkbox.Root
                      checked={useCurrentTabs}
                      onCheckedChange={(e) => setUseCurrentTabs(!!e.checked)}
                      colorPalette={accentColor}
                      size="sm"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>
                        <Text fontSize="xs">Use current tabs</Text>
                      </Checkbox.Label>
                    </Checkbox.Root>
                    <Flex justify="flex-end" gap={1}>
                      <IconButton
                        aria-label="Cancel"
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setCreateOpen(false);
                          setNewWorkspaceName('');
                          setUseCurrentTabs(false);
                        }}
                      >
                        <IconX size={14} />
                      </IconButton>
                      <IconButton
                        aria-label="Create"
                        size="xs"
                        variant="solid"
                        colorPalette={accentColor}
                        onClick={handleCreateWorkspace}
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

      <VStack gap={1} align="stretch">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={workspaceIds}
            strategy={verticalListSortingStrategy}
          >
            {profileWorkspaces.map((workspace) => (
              <SortableWorkspaceItem
                key={workspace.id}
                workspace={workspace}
                isActive={activeWorkspaceId === workspace.id}
                accentColor={accentColor}
                onSwitch={() => switchWorkspace(workspace.id)}
                onRename={(newName) => renameWorkspace(workspace.id, newName)}
                onDelete={() => handleDeleteWorkspace(workspace.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {profileWorkspaces.length === 0 && (
          <Text
            fontSize="sm"
            color="fg.subtle"
            px={3}
            py={4}
            textAlign="center"
          >
            No workspaces yet.{' '}
            <Text
              as="span"
              color={`${accentColor}.400`}
              cursor="pointer"
              onClick={() => setCreateOpen(true)}
            >
              Create one
            </Text>
          </Text>
        )}
      </VStack>
    </Box>
  );
}
