import { Box, Text, Flex } from '@chakra-ui/react';
import { IconLink } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { parseDroppedData } from '@/shared/utils/urlParser';
import {
  useAppStore,
  selectActiveWorkspaceData,
} from '@/features/store/useAppStore';

interface DropZoneProps {
  children: ReactNode;
}

export function DropZone({ children }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const addLink = useAppStore((state) => state.addLink);
  const activeWorkspaceData = useAppStore(selectActiveWorkspaceData);
  const accentColor = useAppStore((state) => state.accentColor);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only accept URLs
    if (
      e.dataTransfer.types.includes('text/uri-list') ||
      e.dataTransfer.types.includes('text/html') ||
      e.dataTransfer.types.includes('text/plain')
    ) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const parsed = parseDroppedData(e.dataTransfer);

    if (parsed) {
      addLink(parsed.url, parsed.title, parsed.favicon);
    }
  };

  // Show empty state if no links
  const isEmpty = !activeWorkspaceData?.links.length;

  return (
    <Box
      flex={1}
      h="100%"
      position="relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <Flex
          position="absolute"
          inset={4}
          bg={`${accentColor}.900/30`}
          borderRadius="xl"
          borderWidth="2px"
          borderStyle="dashed"
          borderColor={`${accentColor}.500`}
          zIndex={10}
          align="center"
          justify="center"
          direction="column"
          gap={2}
          pointerEvents="none"
        >
          <IconLink
            size={32}
            color={`var(--chakra-colors-${accentColor}-400)`}
          />
          <Text color={`${accentColor}.400`} fontWeight="medium">
            Drop link here
          </Text>
        </Flex>
      )}

      {/* Empty state */}
      {isEmpty && !isDragOver && (
        <Flex
          h="100%"
          align="center"
          justify="center"
          direction="column"
          gap={4}
          color="gray.500"
        >
          <IconLink size={48} stroke={1.5} />
          <Text fontSize="lg" fontWeight="medium">
            No links yet
          </Text>
          <Text fontSize="sm" textAlign="center" maxW="300px">
            Drag tabs from your browser here or use the button below to add
            links
          </Text>
        </Flex>
      )}

      {/* Content */}
      {!isEmpty && children}
    </Box>
  );
}
