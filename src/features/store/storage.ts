/**
 * Storage keys and helpers for session/portable data separation
 * 
 * SESSION DATA (kanso_session):
 * - Device-specific, never synced to Gist
 * - PAT, gistId, active profile/workspace, profile-workspace map
 * 
 * PORTABLE DATA (kanso_portable):
 * - Cached from Gist, synced across devices
 * - Profiles, workspaces, workspace data (links)
 */

import type { SessionState, PortableState } from './types'

// Storage keys
const SESSION_KEY = 'kanso_session'
const PORTABLE_KEY = 'kanso_portable'

// Default states
const DEFAULT_SESSION: SessionState = {
  pat: null,
  gistId: null,
  activeProfileId: null,
  activeWorkspaceId: null,
  profileWorkspaceMap: {},
}

const DEFAULT_PORTABLE: PortableState = {
  profiles: [],
  workspaces: [],
  workspaceDataCache: {},
  lastSyncedAt: null,
}

// ============================================================================
// SESSION STORAGE (device-specific)
// ============================================================================

/**
 * Load session state from chrome.storage.local
 */
export async function loadSession(): Promise<SessionState> {
  try {
    const result = await chrome.storage.local.get([SESSION_KEY]) as { [SESSION_KEY]?: Partial<SessionState> }
    const stored = result[SESSION_KEY]
    
    if (!stored) {
      return DEFAULT_SESSION
    }
    
    // Merge with defaults to handle missing fields
    return {
      ...DEFAULT_SESSION,
      ...stored,
    }
  } catch {
    return DEFAULT_SESSION
  }
}

/**
 * Save session state to chrome.storage.local
 */
export async function saveSession(session: Partial<SessionState>): Promise<void> {
  const current = await loadSession()
  const updated = { ...current, ...session }
  await chrome.storage.local.set({ [SESSION_KEY]: updated })
}

/**
 * Clear session (logout)
 */
export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove([SESSION_KEY])
}

// ============================================================================
// PORTABLE STORAGE (Gist-synced cache)
// ============================================================================

/**
 * Load portable state from chrome.storage.local
 */
export async function loadPortable(): Promise<PortableState> {
  try {
    const result = await chrome.storage.local.get([PORTABLE_KEY]) as { [PORTABLE_KEY]?: Partial<PortableState> }
    const stored = result[PORTABLE_KEY]
    
    if (!stored) {
      return DEFAULT_PORTABLE
    }
    
    // Merge with defaults to handle missing fields
    return {
      ...DEFAULT_PORTABLE,
      ...stored,
    }
  } catch {
    return DEFAULT_PORTABLE
  }
}

/**
 * Save portable state to chrome.storage.local
 */
export async function savePortable(portable: Partial<PortableState>): Promise<void> {
  const current = await loadPortable()
  const updated = {
    ...current,
    ...portable,
    lastSyncedAt: Date.now(),
  }
  await chrome.storage.local.set({ [PORTABLE_KEY]: updated })
}

/**
 * Clear portable cache (used when logging out)
 */
export async function clearPortable(): Promise<void> {
  await chrome.storage.local.remove([PORTABLE_KEY])
}

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Clear all Kanso data from storage
 */
export async function clearAll(): Promise<void> {
  await chrome.storage.local.remove([SESSION_KEY, PORTABLE_KEY])
}

/**
 * Check if user has credentials (fast check without full load)
 */
export async function hasCredentials(): Promise<boolean> {
  const session = await loadSession()
  return Boolean(session.pat && session.gistId)
}

/**
 * Check if we have cached portable data
 */
export async function hasCache(): Promise<boolean> {
  const portable = await loadPortable()
  return portable.profiles.length > 0 || portable.workspaces.length > 0
}
