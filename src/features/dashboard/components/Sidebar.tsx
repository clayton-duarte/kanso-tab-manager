import {
  Box,
  VStack,
  Text,
  IconButton,
  Flex,
  Input,
  HStack,
} from '@chakra-ui/react';
import {
  IconPlus,
  IconFolder,
  IconCheck,
  IconX,
  IconTrash,
  IconPencil,
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '@/features/store/useAppStore';
import type { WorkspaceMeta } from '@/features/github/types';

interface SortableWorkspaceItemProps {
  workspace: WorkspaceMeta;
  isActive: boolean;
  accentColor: string;
  onSwitch: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SortableWorkspaceItem({
  workspace,
  isActive,
  accentColor,
  onSwitch,
  onStartRename,
  onDelete,
}: SortableWorkspaceItemProps) {
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

  return (
    <Flex
      ref={setNodeRef}
      style={style}
      align="center"
      gap={1}
      px={2}
      py={2}
      borderRadius="md"
      cursor="pointer"
      bg={isActive ? `${accentColor}.900/40` : 'transparent'}
      color={isActive ? `${accentColor}.300` : 'gray.400'}
      borderLeftWidth="2px"
      borderLeftColor={isActive ? `${accentColor}.500` : 'transparent'}
      onClick={onSwitch}
    >
      <Box
        {...attributes}
        {...listeners}
        cursor="grab"
        color="gray.500"
        _hover={{ color: 'gray.300' }}
        onClick={(e) => e.stopPropagation()}
      >
        <IconGripVertical size={14} />
      </Box>
      <IconFolder size={16} />
      <Text fontSize="sm" flex={1} lineClamp={1}>
        {workspace.name}
      </Text>
      <IconButton
        aria-label="Rename workspace"
        size="xs"
        variant="ghost"
        colorPalette={accentColor}
        onClick={onStartRename}
      >
        <IconPencil size={14} />
      </IconButton>
      <IconButton
        aria-label="Delete workspace"
        size="xs"
        variant="ghost"
        colorPalette={accentColor}
        onClick={onDelete}
      >
        <IconTrash size={14} />
      </IconButton>
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

  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(
    null
  );
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('');

  // Get current profile name
  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // Filter workspaces for current profile
  const profileWorkspaces = workspaces.filter(
    (w) => w.profile === activeProfile?.name
  );

  const handleCreateWorkspace = async () => {
    if (newWorkspaceName.trim()) {
      await createWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateWorkspace();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewWorkspaceName('');
    }
  };

  const handleDeleteWorkspace = async (
    e: React.MouseEvent,
    workspaceId: string
  ) => {
    e.stopPropagation();
    await deleteWorkspace(workspaceId);
  };

  const handleStartRename = (
    e: React.MouseEvent,
    workspace: { id: string; name: string }
  ) => {
    e.stopPropagation();
    setEditingWorkspaceId(workspace.id);
    setEditingWorkspaceName(workspace.name);
  };

  const handleRenameWorkspace = async () => {
    if (editingWorkspaceId && editingWorkspaceName.trim()) {
      await renameWorkspace(editingWorkspaceId, editingWorkspaceName.trim());
    }
    setEditingWorkspaceId(null);
    setEditingWorkspaceName('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameWorkspace();
    } else if (e.key === 'Escape') {
      setEditingWorkspaceId(null);
      setEditingWorkspaceName('');
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
      bg="gray.850"
      borderRightWidth="1px"
      borderColor="gray.700"
      w="240px"
      minW="240px"
      h="100%"
      overflowY="auto"
    >
      <Flex
        justify="space-between"
        align="center"
        px={4}
        py={3}
        borderBottomWidth="1px"
        borderColor="gray.700"
      >
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color="gray.400"
          textTransform="uppercase"
        >
          Workspaces
        </Text>
        <IconButton
          aria-label="Add workspace"
          size="xs"
          variant="ghost"
          colorPalette={accentColor}
          onClick={() => setIsCreating(true)}
        >
          <IconPlus size={14} />
        </IconButton>
      </Flex>

      <VStack gap={1} align="stretch" p={2}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={workspaceIds}
            strategy={verticalListSortingStrategy}
          >
            {profileWorkspaces.map((workspace) =>
              editingWorkspaceId === workspace.id ? (
                <HStack key={workspace.id} gap={1} px={2}>
                  <Input
                    size="sm"
                    value={editingWorkspaceName}
                    onChange={(e) => setEditingWorkspaceName(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    autoFocus
                    variant="outline"
                  />
                  <IconButton
                    aria-label="Confirm"
                    size="xs"
                    colorPalette={accentColor}
                    onClick={handleRenameWorkspace}
                  >
                    <IconCheck size={14} />
                  </IconButton>
                  <IconButton
                    aria-label="Cancel"
                    size="xs"
                    variant="ghost"
                    colorPalette={accentColor}
                    onClick={() => {
                      setEditingWorkspaceId(null);
                      setEditingWorkspaceName('');
                    }}
                  >
                    <IconX size={14} />
                  </IconButton>
                </HStack>
              ) : (
                <SortableWorkspaceItem
                  key={workspace.id}
                  workspace={workspace}
                  isActive={activeWorkspaceId === workspace.id}
                  accentColor={accentColor}
                  onSwitch={() => switchWorkspace(workspace.id)}
                  onStartRename={(e) => handleStartRename(e, workspace)}
                  onDelete={(e) => handleDeleteWorkspace(e, workspace.id)}
                />
              )
            )}
          </SortableContext>
        </DndContext>

        {isCreating && (
          <HStack gap={1} px={2}>
            <Input
              size="sm"
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              variant="outline"
            />
            <IconButton
              aria-label="Confirm"
              size="xs"
              variant="ghost"
              colorPalette={accentColor}
              onClick={handleCreateWorkspace}
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
                setNewWorkspaceName('');
              }}
            >
              <IconX size={14} />
            </IconButton>
          </HStack>
        )}

        {profileWorkspaces.length === 0 && !isCreating && (
          <Text fontSize="sm" color="gray.500" px={3} py={4} textAlign="center">
            No workspaces yet.{' '}
            <Text
              as="span"
              color={`${accentColor}.400`}
              cursor="pointer"
              onClick={() => setIsCreating(true)}
            >
              Create one
            </Text>
          </Text>
        )}
      </VStack>
    </Box>
  );
}
