import {
  Box,
  Flex,
  IconButton,
  Text,
  Input,
  HStack,
  ProgressCircle,
  Popover,
  Portal,
  Switch,
  VStack,
  Dialog,
  Button,
} from '@chakra-ui/react';
import {
  IconPlus,
  IconSettings,
  IconCheck,
  IconX,
  IconGripVertical,
  IconChevronDown,
  IconTrash,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';
import { useState, useMemo, useEffect } from 'react';
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '@/features/store/useAppStore';
import { closeAllTabs } from '@/shared/utils/chromeTabs';
import { KansoLogo } from '@/shared/components/KansoLogo';
import type { Profile } from '@/features/github/types';

interface SortableProfileItemProps {
  profile: Profile;
  isActive: boolean;
  accentColor: string;
  onSwitch: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

function SortableProfileItem({
  profile,
  isActive,
  accentColor,
  onSwitch,
  onRename,
  onDelete,
}: SortableProfileItemProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile.name);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Reset form when popover opens
  useEffect(() => {
    if (open) {
      setName(profile.name);
    }
  }, [open, profile.name]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: profile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    if (name.trim() && name.trim() !== profile.name) {
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
      borderBottomWidth="2px"
      borderBottomColor={isActive ? `${accentColor}.border` : 'transparent'}
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
      <Text fontSize="sm" minW={0} lineClamp={1}>
        {profile.name}
      </Text>
      <Popover.Root
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        positioning={{ placement: 'bottom-end' }}
      >
        <Popover.Trigger asChild>
          <IconButton
            aria-label="Profile menu"
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
                      placeholder="Profile name"
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
                <Dialog.Title>Delete Profile?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text color="fg.muted">
                  Are you sure you want to delete "{profile.name}"? All
                  workspaces and links in this profile will be lost. This action
                  cannot be undone.
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

interface TopBarProps {
  onOpenSettings: () => void;
}

export function TopBar({ onOpenSettings }: TopBarProps) {
  const {
    profiles,
    activeProfileId,
    switchProfile,
    createProfile,
    deleteProfile,
    renameProfile,
    reorderProfiles,
    isSaving,
    isSyncing,
    accentColor,
    colorMode,
    setColorMode,
  } = useAppStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  // Resolve color mode for switch state (light switch: ON = light, OFF = dark)
  const isLightMode = useMemo(() => {
    if (colorMode === 'system') {
      return !window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return colorMode === 'light';
  }, [colorMode]);

  const handleToggleColorMode = () => {
    // Toggle between light and dark (explicit choice replaces system)
    setColorMode(isLightMode ? 'dark' : 'light');
  };

  const handleDeleteProfile = (profileId: string) => {
    if (profiles.length > 1) {
      deleteProfile(profileId);
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
      const oldIndex = profiles.findIndex((p) => p.id === active.id);
      const newIndex = profiles.findIndex((p) => p.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderProfiles(oldIndex, newIndex);
      }
    }
  };

  const profileIds = profiles.map((p) => p.id);

  const handleCreateProfile = () => {
    if (newProfileName.trim()) {
      createProfile(newProfileName.trim());
      setNewProfileName('');
      setCreateOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateProfile();
    } else if (e.key === 'Escape') {
      setCreateOpen(false);
      setNewProfileName('');
    }
  };

  return (
    <Box
      as="header"
      bg="bg"
      borderBottomWidth="1px"
      borderColor="border"
      pr={4}
    >
      <Flex justify="space-between" align="center">
        <HStack gap={0}>
          <HStack
            w="240px"
            px={4}
            borderRightWidth="1px"
            borderColor="border"
            gap={2}
            cursor="pointer"
            onClick={closeAllTabs}
            title="Close all tabs"
          >
            <KansoLogo size="24px" accentColor={accentColor} />
            <Text
              fontSize="lg"
              fontWeight="bold"
              color={`${accentColor}.solid`}
              letterSpacing="tight"
            >
              Kanso
            </Text>
          </HStack>

          <HStack gap={0}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={profileIds}
                strategy={horizontalListSortingStrategy}
              >
                {profiles.map((profile) => (
                  <SortableProfileItem
                    key={profile.id}
                    profile={profile}
                    isActive={profile.id === activeProfileId}
                    accentColor={accentColor}
                    onSwitch={() => switchProfile(profile.id)}
                    onRename={(newName) => renameProfile(profile.id, newName)}
                    onDelete={() => handleDeleteProfile(profile.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <Popover.Root
              open={createOpen}
              onOpenChange={(e) => {
                setCreateOpen(e.open);
                if (!e.open) setNewProfileName('');
              }}
              positioning={{ placement: 'bottom-end' }}
            >
              <Popover.Trigger asChild>
                <IconButton
                  aria-label="Add profile"
                  size="xs"
                  variant="ghost"
                  colorPalette={accentColor}
                >
                  <IconPlus size={16} />
                </IconButton>
              </Popover.Trigger>
              <Portal>
                <Popover.Positioner>
                  <Popover.Content w="200px">
                    <Popover.Body p={3}>
                      <VStack gap={3} align="stretch">
                        <Box>
                          <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb={1}>
                            Name
                          </Text>
                          <Input
                            size="sm"
                            placeholder="Profile name"
                            value={newProfileName}
                            onChange={(e) => setNewProfileName(e.target.value)}
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
                              setNewProfileName('');
                            }}
                          >
                            <IconX size={14} />
                          </IconButton>
                          <IconButton
                            aria-label="Create"
                            size="xs"
                            variant="solid"
                            colorPalette={accentColor}
                            onClick={handleCreateProfile}
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
          </HStack>
        </HStack>

        <HStack gap={2}>
          {(isSaving || isSyncing) && (
            <ProgressCircle.Root
              colorPalette={accentColor}
              value={null}
              size="xs"
            >
              <ProgressCircle.Circle>
                <ProgressCircle.Track />
                <ProgressCircle.Range />
              </ProgressCircle.Circle>
            </ProgressCircle.Root>
          )}
          <Switch.Root
            checked={isLightMode}
            colorPalette={accentColor}
            onCheckedChange={handleToggleColorMode}
            size="md"
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Indicator fallback={<IconMoon size={12} />}>
                <IconSun size={12} />
              </Switch.Indicator>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Root>
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
  );
}
