import {
  Box,
  Flex,
  Tabs,
  IconButton,
  Text,
  Input,
  HStack,
  ProgressCircle,
  Menu,
  Portal,
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '@/features/store/useAppStore';
import type { Profile } from '@/features/github/types';

interface SortableProfileTabProps {
  profile: Profile;
  isActive: boolean;
  accentColor: string;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableProfileTab({
  profile,
  isActive,
  accentColor,
  onEdit,
  onDelete,
}: SortableProfileTabProps) {
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
    <Tabs.Trigger
      ref={setNodeRef}
      style={style}
      value={profile.id}
      pl={2}
      pr={0}
      fontSize="sm"
      display="flex"
      alignItems="center"
      gap={2}
    >
      <Box
        {...attributes}
        {...listeners}
        cursor="grab"
        color={isActive ? `${accentColor}.400` : 'gray.500'}
        _hover={{ color: isActive ? `${accentColor}.300` : 'gray.400' }}
        onClick={(e) => e.stopPropagation()}
      >
        <IconGripVertical size={12} />
      </Box>
      <Text as="span" lineClamp={1}>
        {profile.name}
      </Text>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            aria-label="Profile menu"
            size="2xs"
            variant="ghost"
            colorPalette={accentColor}
            onClick={(e) => e.stopPropagation()}
          >
            <IconChevronDown size={12} />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item value="edit" onClick={onEdit}>
                <IconPencil size={14} />
                Edit
              </Menu.Item>
              <Menu.Item
                value="delete"
                color="fg.error"
                _hover={{ bg: 'bg.error', color: 'fg.error' }}
                onClick={onDelete}
              >
                <IconTrash size={14} />
                Delete
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Tabs.Trigger>
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
  } = useAppStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');

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
      bg="gray.900"
      borderBottomWidth="1px"
      borderColor="gray.700"
      pr={4}
    >
      <Flex justify="space-between" align="center">
        <HStack gap={0}>
          <Box w="240px" p={4}
                borderRightWidth="1px"
      borderColor="gray.700">
            <Text
              fontSize="lg"
              fontWeight="bold"
              color={`${accentColor}.400`}
              letterSpacing="tight"
            >
              Kanso
            </Text>
          </Box>

          <Tabs.Root
            value={activeProfileId || ''}
            onValueChange={(details) => switchProfile(details.value)}
            colorPalette={accentColor}
            alignSelf="end"
            variant="line"
            size="lg"
          >
            <Tabs.List bg="transparent" borderBottomWidth={0}>
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
                          size="2xs"
                          variant="ghost"
                          colorPalette={accentColor}
                          onClick={handleRenameProfile}
                        >
                          <IconCheck size={12} />
                        </IconButton>
                        <IconButton
                          aria-label="Cancel"
                          size="2xs"
                          variant="ghost"
                          colorPalette={accentColor}
                          onClick={() => {
                            setEditingProfileId(null);
                            setEditingProfileName('');
                          }}
                        >
                          <IconX size={12} />
                        </IconButton>
                      </HStack>
                    ) : (
                      <SortableProfileTab
                        key={profile.id}
                        profile={profile}
                        isActive={profile.id === activeProfileId}
                        accentColor={accentColor}
                        onEdit={() => handleStartEdit(profile.id, profile.name)}
                        onDelete={() => handleDeleteProfile(profile.id)}
                      />
                    )
                  )}
                </SortableContext>
              </DndContext>

              {isCreating ? (
                <HStack gap={1} ml={2}>
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
                    variant="ghost"
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
                  ml={2}
                  onClick={() => setIsCreating(true)}
                >
                  <IconPlus size={16} />
                </IconButton>
              )}
            </Tabs.List>
          </Tabs.Root>
        </HStack>

        <HStack gap={2}>
          {(isSaving || isSyncing) && (
            <ProgressCircle.Root
              value={null}
              size="xs"
              colorPalette={accentColor}
            >
              <ProgressCircle.Circle>
                <ProgressCircle.Track />
                <ProgressCircle.Range />
              </ProgressCircle.Circle>
            </ProgressCircle.Root>
          )}
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
