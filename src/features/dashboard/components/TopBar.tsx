import {
  Box,
  Flex,
  Tabs,
  IconButton,
  Text,
  Input,
  HStack,
  ProgressCircle,
} from '@chakra-ui/react';
import {
  IconPlus,
  IconSettings,
  IconCheck,
  IconX,
  IconGripVertical,
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
}

function SortableProfileTab({
  profile,
  isActive,
  accentColor,
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
      px={3}
      py={1.5}
      fontSize="sm"
      display="flex"
      alignItems="center"
      gap={1}
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
      {profile.name}
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
    reorderProfiles,
    isSaving,
    isSyncing,
    accentColor,
  } = useAppStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

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
      py={2}
    >
      <Flex justify="space-between" align="center">
        <HStack gap={0}>
          <Box w="240px" px={4}>
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
            variant="line"
            size="sm"
            colorPalette={accentColor}
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
                  {profiles.map((profile) => (
                    <SortableProfileTab
                      key={profile.id}
                      profile={profile}
                      isActive={profile.id === activeProfileId}
                      accentColor={accentColor}
                    />
                  ))}
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
