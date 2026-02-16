/**
 * Parse dropped data to extract URL and title
 */
export interface ParsedLink {
  url: string;
  title: string;
  favicon?: string;
}

/**
 * Fetch the actual page title from a URL
 * Falls back to URL-based title if fetch fails (CORS, network error, etc.)
 */
export async function fetchPageTitle(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      return extractTitleFromUrl(url);
    }

    const html = await response.text();

    // Parse HTML to find title tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      const title = titleMatch[1].trim();
      // Validate title is meaningful (not just numbers, not too short)
      if (
        title.length > 1 &&
        title.length < 200 &&
        !/^\d+$/.test(title) &&
        !/^[\s\d.-]+$/.test(title)
      ) {
        return title;
      }
    }

    return extractTitleFromUrl(url);
  } catch {
    // CORS or network error - fallback to URL-based title
    return extractTitleFromUrl(url);
  }
}

/**
 * Extract URL from various drag data transfer formats
 * Note: Does not include favicon - caller should use getFaviconFromChrome for best results
 */
export function parseDroppedData(
  dataTransfer: DataTransfer
): ParsedLink | null {
  // Try text/uri-list first (standard for URLs)
  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    const urls = uriList
      .split('\n')
      .filter((line) => !line.startsWith('#') && line.trim());
    if (urls.length > 0) {
      const url = urls[0].trim();
      return {
        url,
        title: extractTitleFromUrl(url),
        // Don't set favicon here - let caller fetch from Chrome
      };
    }
  }

  // Try text/html for rich link data
  const html = dataTransfer.getData('text/html');
  if (html) {
    const parsed = parseHtmlForLink(html);
    if (parsed) {
      return {
        ...parsed,
        // Don't set favicon here - let caller fetch from Chrome
      };
    }
  }

  // Fallback to text/plain
  const text = dataTransfer.getData('text/plain');
  if (text && isValidUrl(text)) {
    return {
      url: text.trim(),
      title: extractTitleFromUrl(text.trim()),
      // Don't set favicon here - let caller fetch from Chrome
    };
  }

  return null;
}

/**
 * Parse HTML string to extract link URL and title
 */
function parseHtmlForLink(html: string): { url: string; title: string } | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Look for anchor tag
  const anchor = doc.querySelector('a');
  if (anchor?.href) {
    return {
      url: anchor.href,
      title: anchor.textContent?.trim() || extractTitleFromUrl(anchor.href),
    };
  }

  return null;
}

/**
 * Extract a readable title from URL
 */
export function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Get the pathname without leading/trailing slashes
    const pathname = urlObj.pathname.replace(/^\/|\/$/g, '');

    if (pathname) {
      // Get the last segment of the path
      const segments = pathname.split('/');
      const lastSegment = segments[segments.length - 1];

      // Clean up the segment (remove file extension, replace dashes/underscores)
      const cleaned = lastSegment
        .replace(/\.[^.]+$/, '') // Remove file extension
        .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
        .replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space before capital letters

      if (cleaned.length > 0 && cleaned.length < 100) {
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
    }

    // Fallback to hostname
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Data from Chrome tab
 */
export interface ChromeTabData {
  title: string;
  favicon: string;
}

/**
 * Get title and favicon from Chrome tabs API
 * Returns data from an open tab, or empty values if not found
 * Only returns data from fully loaded tabs (not suspended/discarded)
 */
export async function getTabDataFromChrome(url: string): Promise<ChromeTabData> {
  try {
    // Only works in extension context
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return { title: '', favicon: '' };
    }

    const urlObj = new URL(url);
    const targetHostname = urlObj.hostname;

    const tabs = await chrome.tabs.query({});
    
    // First try exact URL match with a loaded tab
    let matchingTab = tabs.find((tab) => 
      tab.url === url && 
      !tab.discarded && // Skip suspended tabs
      tab.title // Must have a title (indicates loaded)
    );
    
    // Then try matching by hostname
    if (!matchingTab) {
      matchingTab = tabs.find((tab) => {
        if (tab.discarded || !tab.title) return false;
        try {
          const tabUrl = new URL(tab.url || '');
          return tabUrl.hostname === targetHostname;
        } catch {
          return false;
        }
      });
    }

    if (matchingTab) {
      const title = matchingTab.title || '';
      let favicon = matchingTab.favIconUrl || '';
      
      // Skip internal chrome URLs for favicon
      if (favicon.startsWith('chrome://') || favicon.startsWith('chrome-extension://')) {
        favicon = '';
      }
      
      return { title, favicon };
    }

    return { title: '', favicon: '' };
  } catch {
    return { title: '', favicon: '' };
  }
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Generate filename for a workspace in the Gist
 * Format: [Profile]__[Workspace].json
 */
export function generateWorkspaceFilename(
  profile: string,
  workspace: string
): string {
  const sanitize = (str: string) =>
    str
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

  return `${sanitize(profile)}__${sanitize(workspace)}.json`;
}

/**
 * Generate filename for profile settings in the Gist
 * Format: [Profile].json (no double underscore)
 */
export function generateProfileSettingsFilename(profile: string): string {
  const sanitize = (str: string) =>
    str
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

  return `${sanitize(profile)}.json`;
}

/**
 * Parse workspace filename to extract profile and workspace names
 * Returns null if it's not a workspace file (no __ separator)
 */
export function parseWorkspaceFilename(
  filename: string
): { profile: string; workspace: string } | null {
  // Skip non-json files
  if (!filename.endsWith('.json')) return null;

  // Remove .json extension
  const nameWithoutExt = filename.replace(/\.json$/, '');

  // Split by __ - if no __, this is a profile settings file, not workspace
  const parts = nameWithoutExt.split('__');

  if (parts.length !== 2) {
    return null;
  }

  return {
    profile: parts[0].replace(/_/g, ' '),
    workspace: parts[1].replace(/_/g, ' '),
  };
}

/**
 * Parse profile settings filename
 * Returns profile name if it's a profile settings file (no __ separator)
 */
export function parseProfileSettingsFilename(filename: string): string | null {
  // Skip non-json files or special files
  if (!filename.endsWith('.json')) return null;
  if (filename.startsWith('_')) return null; // Skip _preferences.json

  // Remove .json extension
  const nameWithoutExt = filename.replace(/\.json$/, '');

  // If it contains __, it's a workspace file, not profile settings
  if (nameWithoutExt.includes('__')) {
    return null;
  }

  return nameWithoutExt.replace(/_/g, ' ');
}
