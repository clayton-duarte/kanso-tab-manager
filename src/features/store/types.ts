import type {
  LinkItem,
  Profile,
  WorkspaceData,
  WorkspaceMeta,
} from '../github/types';

/**
 * Available accent colors from Chakra UI theme
 */
export type AccentColor =
  | 'gray'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'cyan'
  | 'purple'
  | 'pink';

// ============================================================================
// SESSION STATE (device-specific, never synced to Gist)
// ============================================================================

/**
 * Session state persisted in chrome.storage.local under 'kanso_session'
 * These values are device-specific and should NOT be synced across devices
 */
export interface SessionState {
  /** GitHub Personal Access Token - device-specific credential */
  pat: string | null;
  /** Gist ID used for sync - same across devices but set per-device */
  gistId: string | null;
  /** Currently active profile on this device */
  activeProfileId: string | null;
  /** Currently active workspace on this device */
  activeWorkspaceId: string | null;
  /** Map of profile ID to last used workspace ID (per-device memory) */
  profileWorkspaceMap: Record<string, string>;
}

// ============================================================================
// PORTABLE STATE (synced to Gist, shared across devices)
// ============================================================================

/**
 * Portable state cached in chrome.storage.local under 'kanso_portable'
 * This data is synced to/from GitHub Gist and works offline
 */
export interface PortableState {
  /** All profiles with their settings (accent color, etc.) */
  profiles: Profile[];
  /** All workspace metadata */
  workspaces: WorkspaceMeta[];
  /** Cached workspace data by ID (all loaded workspaces, not just active) */
  workspaceDataCache: Record<string, WorkspaceData>;
  /** Timestamp of last sync from Gist */
  lastSyncedAt: number | null;
}

// ============================================================================
// UI STATE (transient, not persisted)
// ============================================================================

/**
 * Transient UI state - not persisted, reset on app reload
 */
export interface UIState {
  /** Whether initial data load is in progress (blocks welcome screen) */
  isInitializing: boolean;
  /** Auth state derived from session (pat + gistId present) */
  isAuthenticated: boolean;
  /** Current sync error (shown as non-blocking warning) */
  syncError: string | null;
  /** Whether a sync operation is in progress */
  isSyncing: boolean;
  /** Whether data is being saved to Gist */
  isSaving: boolean;
  /** Active accent color (derived from active profile) */
  accentColor: AccentColor;
}

// ============================================================================
// COMBINED STATE
// ============================================================================

/**
 * Complete app state
 */
export interface AppState extends SessionState, PortableState, UIState {}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * App store actions
 */
export interface AppActions {
  // Initialization
  /** Initialize app - load session + cached portable data, then background sync */
  init: () => Promise<void>;

  // Authentication (requires network)
  /** Set credentials and perform initial data fetch (required connection) */
  setCredentials: (pat: string, gistId: string) => Promise<void>;
  /** Create new Gist and set up default profile/workspace (required connection) */
  setupWithNewGist: (pat: string) => Promise<void>;
  /** Clear all local data and log out */
  clearCredentials: () => void;
  /** Delete the Gist from GitHub and log out (requires network) */
  deleteGistAndLogout: () => Promise<void>;

  // Navigation (offline-capable)
  /** Switch to a different profile */
  switchProfile: (profileId: string) => void;
  /** Switch to a different workspace */
  switchWorkspace: (workspaceId: string) => Promise<void>;

  // Profile CRUD (optimistic, sync in background)
  /** Create a new profile */
  createProfile: (name: string) => Promise<void>;
  /** Delete a profile */
  deleteProfile: (profileId: string) => Promise<void>;

  // Workspace CRUD (optimistic, sync in background)
  /** Create a new workspace */
  createWorkspace: (name: string) => Promise<void>;
  /** Delete a workspace */
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  /** Rename a workspace */
  renameWorkspace: (workspaceId: string, newName: string) => Promise<void>;
  /** Reorder workspaces within the active profile */
  reorderWorkspaces: (oldIndex: number, newIndex: number) => void;

  // Link CRUD (optimistic, sync debounced)
  /** Add a link to the active workspace */
  addLink: (url: string, title: string, favicon?: string) => void;
  /** Remove a link from the active workspace */
  removeLink: (linkId: string) => void;
  /** Update a link's properties */
  updateLink: (linkId: string, updates: Partial<LinkItem>) => void;
  /** Toggle a link's pinned status */
  togglePinLink: (linkId: string) => void;
  /** Reorder links in the active workspace */
  reorderLinks: (oldIndex: number, newIndex: number) => void;

  // Sync (non-blocking, warns on error)
  /** Save active workspace to Gist (debounced) */
  saveWorkspace: () => void;
  /** Background sync from Gist (non-blocking, warns on error) */
  sync: () => Promise<void>;

  // UI Preferences
  /** Set accent color for active profile */
  setAccentColor: (color: AccentColor) => void;

  // Error handling
  /** Clear sync error warning */
  clearSyncError: () => void;
}

/**
 * Complete store type
 */
export type AppStore = AppState & AppActions;
