import { Box } from '@chakra-ui/react';

interface KansoLogoProps {
  size?: string | number;
  accentColor?: string;
}

// Color mapping for favicon (Chakra semantic colors resolved to hex)
const ACCENT_COLOR_HEX: Record<string, string> = {
  gray: '#71717a',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  purple: '#a855f7',
  pink: '#ec4899',
};

/**
 * Update the browser favicon with the current accent color
 */
export function updateFavicon(accentColor: string) {
  const color = ACCENT_COLOR_HEX[accentColor] || ACCENT_COLOR_HEX.blue;

  const svg = `<svg width="269" height="269" viewBox="0 0 269 269" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0.789062 269H0V0L269 0V0.788086L0.789062 269Z" fill="#e4e4e7"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M269 268.211V269H0V0H0.788086L269 268.211Z" fill="${color}" fill-opacity="0.5"/>
  </svg>`;

  const encodedSvg = encodeURIComponent(svg);
  const dataUrl = `data:image/svg+xml,${encodedSvg}`;

  // Find or create the favicon link element
  let link = document.querySelector(
    "link[rel='icon']"
  ) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    document.head.appendChild(link);
  }

  link.href = dataUrl;
}

export function KansoLogo({
  size = '24px',
  accentColor = 'blue',
}: KansoLogoProps) {
  return (
    <Box as="span" display="inline-flex" boxSize={size}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 269 269"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0.789062 269H0V0L269 0V0.788086L0.789062 269Z"
          fill="currentColor"
        />
        <path
          id="kanso-shadow"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M269 268.211V269H0V0H0.788086L269 268.211Z"
          fill={`var(--chakra-colors-${accentColor}-solid)`}
          fillOpacity="0.5"
        />
      </svg>
    </Box>
  );
}
