import type {
  GistResponse,
  GistUpdatePayload,
  WorkspaceData,
  ProfileSettings,
  GlobalSettings,
} from './types';
import { DEFAULT_PROFILE_SETTINGS, GLOBAL_SETTINGS_FILENAME, DEFAULT_GLOBAL_SETTINGS } from './types';
import { generateProfileSettingsFilename } from '@/shared/utils/urlParser';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Error class for GitHub API errors
 */
export class GitHubApiError extends Error {
  status: number;
  response?: unknown;

  constructor(message: string, status: number, response?: unknown) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.response = response;
  }
}

/**
 * Create headers for GitHub API requests
 */
function createHeaders(pat: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${pat}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/**
 * Handle API response errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `GitHub API error: ${response.status}`;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // Ignore JSON parsing errors
    }

    throw new GitHubApiError(errorMessage, response.status);
  }

  return response.json();
}

/**
 * Fetch a Gist by ID
 * Adds cache-busting to avoid stale data
 */
export async function fetchGist(
  gistId: string,
  pat: string
): Promise<GistResponse> {
  const response = await fetch(
    `${GITHUB_API_BASE}/gists/${gistId}?cb=${Date.now()}`,
    {
      method: 'GET',
      headers: createHeaders(pat),
      cache: 'no-store',
    }
  );

  return handleResponse<GistResponse>(response);
}

/**
 * Update a specific file in a Gist
 */
export async function updateGistFile(
  gistId: string,
  filename: string,
  content: string,
  pat: string
): Promise<GistResponse> {
  const payload: GistUpdatePayload = {
    files: {
      [filename]: { content },
    },
  };

  const response = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
    method: 'PATCH',
    headers: createHeaders(pat),
    body: JSON.stringify(payload),
  });

  return handleResponse<GistResponse>(response);
}

/**
 * Create a new file in a Gist
 * (Same as update - GitHub creates if doesn't exist)
 */
export async function createGistFile(
  gistId: string,
  filename: string,
  content: string,
  pat: string
): Promise<GistResponse> {
  return updateGistFile(gistId, filename, content, pat);
}

/**
 * Delete a file from a Gist
 */
export async function deleteGistFile(
  gistId: string,
  filename: string,
  pat: string
): Promise<GistResponse> {
  const payload: GistUpdatePayload = {
    files: {
      [filename]: null,
    },
  };

  const response = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
    method: 'PATCH',
    headers: createHeaders(pat),
    body: JSON.stringify(payload),
  });

  return handleResponse<GistResponse>(response);
}

/**
 * Fetch the content of a specific file in a Gist
 * Raw GitHub URLs are public - no auth headers needed (avoids CORS preflight)
 * Cache-busting via timestamp parameter
 */
export async function fetchGistFileContent(
  rawUrl: string,
  _pat: string
): Promise<string> {
  // Add cache-busting parameter to avoid stale data
  const cacheBustedUrl = `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
  const response = await fetch(cacheBustedUrl, {
    method: 'GET',
    // No auth headers - raw URLs are public and adding headers triggers CORS preflight
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new GitHubApiError('Failed to fetch file content', response.status);
  }

  return response.text();
}

/**
 * Parse workspace data from a Gist file content string
 */
export function parseWorkspaceData(content: string): WorkspaceData | null {
  try {
    const data = JSON.parse(content);

    // Validate required fields
    if (!data.id || !data.name || !data.profile || !Array.isArray(data.links)) {
      return null;
    }

    // Ensure updatedAt exists (backwards compatibility)
    if (!data.updatedAt) {
      data.updatedAt = data.createdAt || 0;
    }

    return data as WorkspaceData;
  } catch {
    return null;
  }
}

/**
 * Serialize workspace data to JSON string
 */
export function serializeWorkspaceData(data: WorkspaceData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Validate a PAT is valid by checking if it can authenticate with GitHub
 * Write permissions are validated by the actual Gist operations (createNewGist, updateGistFile)
 */
export async function validatePat(pat: string): Promise<boolean> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      method: 'GET',
      headers: createHeaders(pat),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Validate a Gist exists and is accessible
 */
export async function validateGist(
  gistId: string,
  pat: string
): Promise<boolean> {
  try {
    await fetchGist(gistId, pat);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a new private Gist for Kanso Tab Manager
 */
export async function createNewGist(pat: string): Promise<string> {
  const response = await fetch(`${GITHUB_API_BASE}/gists`, {
    method: 'POST',
    headers: createHeaders(pat),
    body: JSON.stringify({
      description: 'Kanso Tab Manager Data',
      public: false,
      files: {
        'README.md': {
          content: '# Kanso Tab Manager Data\n\nInitializing...',
        },
      },
    }),
  });

  const gist = await handleResponse<GistResponse>(response);

  // Update README with Gist ID and sync instructions
  const readmeContent = `# Kanso Tab Manager Data

This Gist stores workspace data for the [Kanso Tab Manager](https://github.com/your-repo/kanso-tab-manager) Chrome extension.

## ⚠️ Do not edit these files manually

The JSON files in this Gist are managed by the extension. Manual edits may cause data loss.

## 🔗 Sync to Another Device

To connect this Gist to the Kanso extension on another browser or device:

1. Install the Kanso Tab Manager extension
2. On the welcome screen, select **"Restore / Connect to existing Gist"**
3. Enter your GitHub Personal Access Token (with \`gist\` scope)
4. Enter this Gist ID:

\`\`\`
${gist.id}
\`\`\`

Your workspaces and links will sync automatically.

---
*Managed by Kanso Tab Manager*
`;

  await updateGistFile(gist.id, 'README.md', readmeContent, pat);

  return gist.id;
}

/**
 * Fetch profile settings from Gist
 */
export async function fetchProfileSettings(
  gistId: string,
  profileName: string,
  pat: string
): Promise<ProfileSettings> {
  try {
    const filename = generateProfileSettingsFilename(profileName);
    const gist = await fetchGist(gistId, pat);
    const settingsFile = gist.files[filename];

    if (!settingsFile) {
      return { name: profileName, ...DEFAULT_PROFILE_SETTINGS };
    }

    // Use inline content if available (more reliable than raw_url which can be cached)
    let content: string;
    if (settingsFile.content && !settingsFile.truncated) {
      content = settingsFile.content;
    } else if (settingsFile.raw_url) {
      content = await fetchGistFileContent(settingsFile.raw_url, pat);
    } else {
      return { name: profileName, ...DEFAULT_PROFILE_SETTINGS };
    }

    return JSON.parse(content) as ProfileSettings;
  } catch {
    // If settings file doesn't exist, return defaults
    return { name: profileName, ...DEFAULT_PROFILE_SETTINGS };
  }
}

/**
 * Save profile settings to Gist
 */
export async function saveProfileSettings(
  gistId: string,
  profileName: string,
  settings: ProfileSettings,
  pat: string
): Promise<void> {
  const filename = generateProfileSettingsFilename(profileName);
  await updateGistFile(
    gistId,
    filename,
    JSON.stringify(settings, null, 2),
    pat
  );
}

/**
 * Fetch global settings from Gist
 */
export async function fetchGlobalSettings(
  gistId: string,
  pat: string
): Promise<GlobalSettings> {
  try {
    const gist = await fetchGist(gistId, pat);
    const settingsFile = gist.files[GLOBAL_SETTINGS_FILENAME];

    if (!settingsFile) {
      return { ...DEFAULT_GLOBAL_SETTINGS };
    }

    let content: string;
    if (settingsFile.content && !settingsFile.truncated) {
      content = settingsFile.content;
    } else if (settingsFile.raw_url) {
      content = await fetchGistFileContent(settingsFile.raw_url, pat);
    } else {
      return { ...DEFAULT_GLOBAL_SETTINGS };
    }

    const parsed = JSON.parse(content) as GlobalSettings;
    // Ensure updatedAt exists for backward compatibility
    if (!parsed.updatedAt) {
      parsed.updatedAt = 0;
    }
    return parsed;
  } catch {
    return { ...DEFAULT_GLOBAL_SETTINGS };
  }
}

/**
 * Save global settings to Gist
 */
export async function saveGlobalSettings(
  gistId: string,
  settings: GlobalSettings,
  pat: string
): Promise<void> {
  await updateGistFile(
    gistId,
    GLOBAL_SETTINGS_FILENAME,
    JSON.stringify(settings, null, 2),
    pat
  );
}
