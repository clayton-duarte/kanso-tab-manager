import type { GistResponse, GistUpdatePayload, WorkspaceData } from './types'

const GITHUB_API_BASE = 'https://api.github.com'

/**
 * Error class for GitHub API errors
 */
export class GitHubApiError extends Error {
  status: number
  response?: unknown

  constructor(message: string, status: number, response?: unknown) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
    this.response = response
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
  }
}

/**
 * Handle API response errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `GitHub API error: ${response.status}`
    
    try {
      const errorData = await response.json()
      errorMessage = errorData.message || errorMessage
    } catch {
      // Ignore JSON parsing errors
    }

    throw new GitHubApiError(errorMessage, response.status)
  }

  return response.json()
}

/**
 * Fetch a Gist by ID
 */
export async function fetchGist(gistId: string, pat: string): Promise<GistResponse> {
  const response = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
    method: 'GET',
    headers: createHeaders(pat),
  })

  return handleResponse<GistResponse>(response)
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
  }

  const response = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
    method: 'PATCH',
    headers: createHeaders(pat),
    body: JSON.stringify(payload),
  })

  return handleResponse<GistResponse>(response)
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
  return updateGistFile(gistId, filename, content, pat)
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
  }

  const response = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
    method: 'PATCH',
    headers: createHeaders(pat),
    body: JSON.stringify(payload),
  })

  return handleResponse<GistResponse>(response)
}

/**
 * Fetch the content of a specific file in a Gist
 */
export async function fetchGistFileContent(
  rawUrl: string,
  pat: string
): Promise<string> {
  const response = await fetch(rawUrl, {
    method: 'GET',
    headers: createHeaders(pat),
  })

  if (!response.ok) {
    throw new GitHubApiError('Failed to fetch file content', response.status)
  }

  return response.text()
}

/**
 * Parse workspace data from a Gist file content string
 */
export function parseWorkspaceData(content: string): WorkspaceData | null {
  try {
    const data = JSON.parse(content)
    
    // Validate required fields
    if (!data.id || !data.name || !data.profile || !Array.isArray(data.links)) {
      return null
    }

    return data as WorkspaceData
  } catch {
    return null
  }
}

/**
 * Serialize workspace data to JSON string
 */
export function serializeWorkspaceData(data: WorkspaceData): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Validate a PAT by attempting to fetch user info
 */
export async function validatePat(pat: string): Promise<boolean> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      method: 'GET',
      headers: createHeaders(pat),
    })

    return response.ok
  } catch {
    return false
  }
}

/**
 * Validate a Gist exists and is accessible
 */
export async function validateGist(gistId: string, pat: string): Promise<boolean> {
  try {
    await fetchGist(gistId, pat)
    return true
  } catch {
    return false
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
          content: '# Kanso Tab Manager Data\n\nThis Gist stores workspace data for the Kanso Tab Manager Chrome extension.\n\nDo not edit these files manually.',
        },
      },
    }),
  })

  const gist = await handleResponse<GistResponse>(response)
  return gist.id
}
