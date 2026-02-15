import {
  Box,
  Flex,
  IconButton,
  Text,
  Input,
  HStack,
  ProgressCircle,
  Menu,
  Portal,
  Switch,
} from '@chakra-ui/react';
import {
  IconPlus,
  IconSettings,
  IconCheck,
  IconX,
  IconGripVertical,
  IconChevronDown,
  IconPencil,
  IconTrash,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
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
import type { Profile } from '@/features/github/types';

interface SortableProfileItemProps {
  profile: Profile;
  isActive: boolean;
  accentColor: string;
  onSwitch: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableProfileItem({
  profile,
  isActive,
  accentColor,
  onSwitch,
  onEdit,
  onDelete,
}: SortableProfileItemProps) {
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
      <Text fontSize="sm" lineClamp={1}>
        {profile.name}
      </Text>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            aria-label="Profile menu"
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
              <Menu.Item value="edit" onClick={onEdit}>
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
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');

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

  const handleStartEdit = (profileId: string, currentName: string) => {
    setEditingProfileId(profileId);
    setEditingProfileName(currentName);
  };

  const handleRenameProfile = () => {
    if (editingProfileId && editingProfileName.trim()) {
      renameProfile(editingProfileId, editingProfileName.trim());
      setEditingProfileId(null);
      setEditingProfileName('');
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameProfile();
    } else if (e.key === 'Escape') {
      setEditingProfileId(null);
      setEditingProfileName('');
    }
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
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateProfile();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
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
          <Box w="240px" px={4} borderRightWidth="1px" borderColor="border">
            <Text
              fontSize="lg"
              fontWeight="bold"
              color={`${accentColor}.solid`}
              letterSpacing="tight"
            >
              Kanso
            </Text>
          </Box>

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
                {profiles.map((profile) =>
                  editingProfileId === profile.id ? (
                    <HStack key={profile.id} gap={1} px={2}>
                      <Input
                        size="sm"
                        value={editingProfileName}
                        onChange={(e) => setEditingProfileName(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        autoFocus
                        width="100px"
                        variant="outline"
                      />
                      <IconButton
                        aria-label="Confirm"
                        size="xs"
                        variant="ghost"
                        colorPalette={accentColor}
                        onClick={handleRenameProfile}
                      >
                        <IconCheck size={14} />
                      </IconButton>
                      <IconButton
                        aria-label="Cancel"
                        size="xs"
                        variant="ghost"
                        colorPalette={accentColor}
                        onClick={() => {
                          setEditingProfileId(null);
                          setEditingProfileName('');
                        }}
                      >
                        <IconX size={14} />
                      </IconButton>
                    </HStack>
                  ) : (
                    <SortableProfileItem
                      key={profile.id}
                      profile={profile}
                      isActive={profile.id === activeProfileId}
                      accentColor={accentColor}
                      onSwitch={() => switchProfile(profile.id)}
                      onEdit={() => handleStartEdit(profile.id, profile.name)}
                      onDelete={() => handleDeleteProfile(profile.id)}
                    />
                  )
                )}
              </SortableContext>
            </DndContext>

            {isCreating ? (
              <HStack gap={1} px={2}>
                <Input
                  size="sm"
                  placeholder="Profile name"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  width="120px"
                  variant="outline"
                />
                <IconButton
                  aria-label="Confirm"
                  size="xs"
                  colorPalette={accentColor}
                  onClick={handleCreateProfile}
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
                    setNewProfileName('');
                  }}
                >
                  <IconX size={14} />
                </IconButton>
              </HStack>
            ) : (
              <IconButton
                aria-label="Add profile"
                size="xs"
                variant="ghost"
                colorPalette={accentColor}
                onClick={() => setIsCreating(true)}
              >
                <IconPlus size={16} />
              </IconButton>
            )}
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
