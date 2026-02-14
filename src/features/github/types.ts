/**
 * Link item stored in a workspace
 */
export interface LinkItem {
  id: string
  url: string
  title: string
  favicon?: string
  pinned: boolean
}

/**
 * Workspace data stored in a Gist file
 * Filename format: [Profile]__[Workspace].json
 */
export interface WorkspaceData {
  id: string
  name: string
  profile: string
  createdAt: number
  updatedAt: number
  links: LinkItem[]
}

/**
 * Profile (top-level container for workspaces)
 */
export interface Profile {
  id: string
  name: string
  createdAt: number
  accentColor: 'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'cyan' | 'purple' | 'pink'
}

/**
 * Profile settings stored in [Profile].json
 */
export interface ProfileSettings {
  name: string
  accentColor: 'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'cyan' | 'purple' | 'pink'
  createdAt: number
  /** Ordered list of workspace IDs for this profile */
  workspaceOrder?: string[]
}

export const DEFAULT_PROFILE_SETTINGS: Omit<ProfileSettings, 'name'> = {
  accentColor: 'gray',
  createdAt: Date.now(),
  workspaceOrder: [],
}

/**
 * Workspace metadata (without full link data)
 */
export interface WorkspaceMeta {
  id: string
  name: string
  profile: string
  filename: string
}

/**
 * GitHub Gist API response types
 */
export interface GistFile {
  filename: string
  type: string
  language: string | null
  raw_url: string
  size: number
  truncated: boolean
  content?: string
}

export interface GistOwner {
  login: string
  id: number
  avatar_url: string
}

export interface GistResponse {
  id: string
  url: string
  files: Record<string, GistFile>
  public: boolean
  created_at: string
  updated_at: string
  description: string
  owner: GistOwner
}

/**
 * Gist file update payload
 */
export interface GistUpdatePayload {
  files: Record<string, { content: string } | null>
}
