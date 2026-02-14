import type { LinkItem, Profile, WorkspaceData, WorkspaceMeta } from '../github/types'

/**
 * Authentication state
 */
export interface AuthState {
  pat: string | null
  gistId: string | null
  isAuthenticated: boolean
}

/**
 * Available accent colors from Chakra UI theme
 */
export type AccentColor = 'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'cyan' | 'purple' | 'pink'

/**
 * UI state
 */
export interface UIState {
  activeProfileId: string | null
  activeWorkspaceId: string | null
  isLoading: boolean
  error: string | null
  isSaving: boolean
  accentColor: AccentColor
}

/**
 * Data state
 */
export interface DataState {
  profiles: Profile[]
  workspaces: WorkspaceMeta[]
  activeWorkspaceData: WorkspaceData | null
}

/**
 * App store state
 */
export interface AppState extends AuthState, UIState, DataState {}

/**
 * App store actions
 */
export interface AppActions {
  // Initialization
  init: () => Promise<void>
  
  // Authentication
  setCredentials: (pat: string, gistId: string) => Promise<void>
  setupWithNewGist: (pat: string) => Promise<void>
  clearCredentials: () => void
  deleteGistAndLogout: () => Promise<void>
  
  // Navigation
  switchProfile: (profileId: string) => Promise<void>
  switchWorkspace: (workspaceId: string) => Promise<void>
  
  // Profile CRUD
  createProfile: (name: string) => Promise<void>
  deleteProfile: (profileId: string) => Promise<void>
  
  // Workspace CRUD
  createWorkspace: (name: string) => Promise<void>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  renameWorkspace: (workspaceId: string, newName: string) => Promise<void>
  
  // Link CRUD
  addLink: (url: string, title: string, favicon?: string) => void
  removeLink: (linkId: string) => void
  updateLink: (linkId: string, updates: Partial<LinkItem>) => void
  togglePinLink: (linkId: string) => void
  reorderLinks: (oldIndex: number, newIndex: number) => void
  
  // Sync
  saveWorkspace: () => Promise<void>
  
  // Error handling
  setError: (error: string | null) => void
  clearError: () => void
  
  // UI Preferences
  setAccentColor: (color: AccentColor) => void
}

/**
 * Complete store type
 */
export type AppStore = AppState & AppActions
