import {
  Box,
  Flex,
  Text,
  IconButton,
  Image,
  Link,
} from '@chakra-ui/react'
import {
  IconPin,
  IconPinnedFilled,
  IconTrash,
  IconGripVertical,
  IconExternalLink,
} from '@tabler/icons-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import type { LinkItem } from '@/features/github/types'
import { useAppStore } from '@/features/store/useAppStore'

interface LinkCardProps {
  link: LinkItem
}

export function LinkCard({ link }: LinkCardProps) {
  const { removeLink, togglePinLink } = useAppStore()
  const [isHovered, setIsHovered] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleOpenLink = () => {
    window.open(link.url, '_blank', 'noopener,noreferrer')
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    removeLink(link.id)
  }

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation()
    togglePinLink(link.id)
  }

  // Extract domain for display
  const domain = (() => {
    try {
      return new URL(link.url).hostname.replace('www.', '')
    } catch {
      return link.url
    }
  })()

  return (
    <Box
      ref={setNodeRef}
      style={style}
      bg="gray.800"
      borderRadius="lg"
      borderWidth="1px"
      borderColor={link.pinned ? 'purple.500' : 'gray.700'}
      p={4}
      cursor="pointer"
      position="relative"
      transition="all 0.2s"
      _hover={{
        borderColor: 'purple.400',
        transform: 'translateY(-2px)',
        shadow: 'lg',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleOpenLink}
    >
      {/* Drag handle */}
      {isHovered && (
        <Box
          position="absolute"
          top={2}
          left={2}
          color="gray.500"
          cursor="grab"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <IconGripVertical size={16} />
        </Box>
      )}

      {/* Action buttons */}
      {isHovered && (
        <Flex position="absolute" top={2} right={2} gap={1}>
          <IconButton
            aria-label={link.pinned ? 'Unpin' : 'Pin'}
            size="xs"
            variant="ghost"
            color={link.pinned ? 'purple.400' : 'gray.500'}
            onClick={handleTogglePin}
            _hover={{ color: 'purple.400' }}
          >
            {link.pinned ? <IconPinnedFilled size={14} /> : <IconPin size={14} />}
          </IconButton>
          <IconButton
            aria-label="Open in new tab"
            size="xs"
            variant="ghost"
            color="gray.500"
            onClick={(e) => {
              e.stopPropagation()
              handleOpenLink()
            }}
            _hover={{ color: 'blue.400' }}
          >
            <IconExternalLink size={14} />
          </IconButton>
          <IconButton
            aria-label="Delete"
            size="xs"
            variant="ghost"
            color="gray.500"
            onClick={handleDelete}
            _hover={{ color: 'red.400' }}
          >
            <IconTrash size={14} />
          </IconButton>
        </Flex>
      )}

      {/* Pinned indicator */}
      {link.pinned && !isHovered && (
        <Box position="absolute" top={2} right={2} color="purple.400">
          <IconPinnedFilled size={14} />
        </Box>
      )}

      {/* Content */}
      <Flex direction="column" gap={2} pt={isHovered ? 4 : 0}>
        <Flex align="center" gap={3}>
          {link.favicon ? (
            <Image
              src={link.favicon}
              alt=""
              boxSize="24px"
              borderRadius="sm"
              fallback={
                <Box
                  boxSize="24px"
                  borderRadius="sm"
                  bg="gray.600"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text fontSize="xs" color="gray.400">
                    {link.title.charAt(0).toUpperCase()}
                  </Text>
                </Box>
              }
            />
          ) : (
            <Box
              boxSize="24px"
              borderRadius="sm"
              bg="gray.600"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="xs" color="gray.400">
                {link.title.charAt(0).toUpperCase()}
              </Text>
            </Box>
          )}
          <Text
            fontSize="sm"
            fontWeight="medium"
            color="white"
            noOfLines={1}
            flex={1}
          >
            {link.title}
          </Text>
        </Flex>

        <Link
          href={link.url}
          fontSize="xs"
          color="gray.500"
          noOfLines={1}
          onClick={(e) => e.stopPropagation()}
          _hover={{ color: 'purple.400' }}
        >
          {domain}
        </Link>
      </Flex>
    </Box>
  )
}
