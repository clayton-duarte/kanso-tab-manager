import { Box, Grid, GridItem, Text, Flex, VStack } from '@chakra-ui/react';
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
} from '@dnd-kit/sortable';
import { useState } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { LinkCard } from './components/LinkCard';
import { DropZone } from './components/DropZone';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SyncStatusBanner } from './components/SyncStatusBanner';
import {
  useAppStore,
  selectActiveWorkspaceData,
} from '@/features/store/useAppStore';

export function DashboardLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeWorkspaceData = useAppStore(selectActiveWorkspaceData);
  const reorderLinks = useAppStore((state) => state.reorderLinks);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && activeWorkspaceData) {
      const oldIndex = activeWorkspaceData.links.findIndex(
        (l) => l.id === active.id
      );
      const newIndex = activeWorkspaceData.links.findIndex(
        (l) => l.id === over.id
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderLinks(oldIndex, newIndex);
      }
    }
  };

  const links = activeWorkspaceData?.links || [];
  const linkIds = links.map((l) => l.id);

  return (
    <Grid
      templateColumns="auto 1fr"
      templateRows="auto auto 1fr"
      h="100vh"
      bg="gray.900"
    >
      {/* Top Bar - spans full width */}
      <GridItem colSpan={2}>
        <TopBar onOpenSettings={() => setSettingsOpen(true)} />
      </GridItem>

      {/* Sync Status Banner - non-blocking warning for sync errors */}
      <GridItem colSpan={2}>
        <SyncStatusBanner />
      </GridItem>

      {/* Sidebar */}
      <GridItem>
        <Sidebar />
      </GridItem>

      {/* Main Content */}
      <GridItem overflow="auto">
        <DropZone>
          {activeWorkspaceData && (
            <Box maxW="700px" mx="auto">
              <Flex justify="space-between" align="center" mb={4}>
                <Text fontSize="xl" fontWeight="bold" color="white">
                  {activeWorkspaceData.name}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {links.length} {links.length === 1 ? 'link' : 'links'}
                </Text>
              </Flex>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={linkIds}
                  strategy={verticalListSortingStrategy}
                >
                  <VStack gap={3} align="stretch">
                    {links.map((link) => (
                      <LinkCard key={link.id} link={link} />
                    ))}
                  </VStack>
                </SortableContext>
              </DndContext>
            </Box>
          )}
        </DropZone>
      </GridItem>

      {/* Settings Drawer */}
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Grid>
  );
}
