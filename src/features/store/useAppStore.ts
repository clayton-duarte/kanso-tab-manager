import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { AppStore, AccentColor, ColorMode } from './types';
import type {
  LinkItem,
  Profile,
  WorkspaceData,
  WorkspaceMeta,
  PinnedLink,
} from '../github/types';
import { DEFAULT_PROFILE_SETTINGS } from '../github/types';
import { debounce } from '@/shared/utils/debounce';
import {
  generateWorkspaceFilename,
  parseWorkspaceFilename,
  parseProfileSettingsFilename,
  generateProfileSettingsFilename,
} from '@/shared/utils/urlParser';
import { switchWorkspaceTabs, switchPinnedTabs, setupTabDataPopulator } from '@/shared/utils/chromeTabs';
import {
  loadSession,
  saveSession,
  loadPortable,
  savePortable,
  clearAll,
} from './storage';
import {
  fetchGist,
  fetchGistFileContent,
  updateGistFile,
  deleteGistFile,
  parseWorkspaceData,
  serializeWorkspaceData,
  validatePat,
  validateGist,
  createNewGist,
  fetchProfileSettings,
  saveProfileSettings,
  fetchGlobalSettings,
  saveGlobalSettings,
} from '../github/api';

// Debounced save function (initialized lazily)
let debouncedSave: ReturnType<typeof debounce> | null = null;

/**
 * Kanso App Store
 *
 * Architecture:
 * - Session State: device-specific (PAT, active selections)
 * - Portable State: synced to Gist (profiles, workspaces, links)
 * - UI State: transient (loading, errors)
 *
 * Offline-First:
 * 1. Init loads cached data immediately (no network)
 * 2. Background sync fetches latest from Gist (non-blocking)
 * 3. Sync errors are warnings, never block the experience
 * 4. Only initial setup requires network connection
 */
export const useAppStore = create<AppStore>((set, get) => ({
  // ============================================================================
  // SESSION STATE (device-specific)
  // ============================================================================
  pat: null,
  gistId: null,
  activeProfileId: null,
  activeWorkspaceId: null,
  profileWorkspaceMap: {},
  colorMode: 'system',
  memorySaverMode: false,

  // ============================================================================
  // PORTABLE STATE (synced to Gist)
  // ============================================================================
  profiles: [],
  workspaces: [],
  workspaceDataCache: {},
  pinnedLinksCache: {},
  lastSyncedAt: null,

  // ============================================================================
  // UI STATE (transient)
  // ============================================================================
  isInitializing: true, // Start true to avoid welcome flash
  isAuthenticated: false,
  syncError: null,
  isSyncing: false,
  isSaving: false,
  accentColor: 'gray',

  // ============================================================================
  // INITIALIZATION (offline-first)
  // ============================================================================

  /**
   * Initialize the app:
   * 1. Load session (credentials, active selections)
   * 2. Load cached portable data (instant, no network)
   * 3. Background sync from Gist (non-blocking)
   */
  init: async () => {
    try {
      // 1. Load session state
      const session = await loadSession();
      const {
        pat,
        gistId,
        activeProfileId,
        activeWorkspaceId,
        profileWorkspaceMap,
        colorMode,
        memorySaverMode,
      } = session;

      // No credentials = not authenticated
      if (!pat || !gistId) {
        set({
          isInitializing: false,
          isAuthenticated: false,
          colorMode,
          memorySaverMode,
        });
        return;
      }

      // 2. Load cached portable data (instant, no network)
      const portable = await loadPortable();

      // Determine active profile/workspace from session or defaults
      const activeProfile =
        portable.profiles.find((p) => p.id === activeProfileId) ||
        portable.profiles[0];
      const activeWorkspace =
        portable.workspaces.find((w) => w.id === activeWorkspaceId) ||
        portable.workspaces.find((w) => w.profile === activeProfile?.name);

      // Set state immediately from cache
      set({
        // Session
        pat,
        gistId,
        activeProfileId: activeProfile?.id || null,
        activeWorkspaceId: activeWorkspace?.id || null,
        profileWorkspaceMap,
        colorMode,
        memorySaverMode,
        // Portable
        profiles: portable.profiles,
        workspaces: portable.workspaces,
        workspaceDataCache: portable.workspaceDataCache,
        pinnedLinksCache: portable.pinnedLinksCache,
        lastSyncedAt: portable.lastSyncedAt,
        // UI
        isAuthenticated: true,
        isInitializing: false,
        accentColor: activeProfile?.accentColor || 'gray',
      });

      // 3. Background sync (non-blocking)
      // Don't await - let UI show cached data immediately
      get().sync();

      // 4. Set up tab data populator to fill missing titles/favicons when tabs load
      setupTabDataPopulator((tabUrl, title, faviconUrl) => {
        get().populateMissingTabData(tabUrl, title, faviconUrl);
      });
    } catch {
      // Even on error, stop initializing so UI can render
      set({ isInitializing: false });
    }
  },

  // ============================================================================
  // AUTHENTICATION (requires network)
  // ============================================================================

  /**
   * Set credentials and fetch initial data
   * This is the only operation that REQUIRES network connection
   */
  setCredentials: async (pat: string, gistId: string) => {
    set({ isSyncing: true, syncError: null });

    try {
      // Validate PAT is valid (requires network)
      const isPatValid = await validatePat(pat);
      if (!isPatValid) {
        set({
          syncError: 'Invalid GitHub Personal Access Token',
          isSyncing: false,
        });
        return;
      }

      // Validate Gist exists (requires network)
      const isGistValid = await validateGist(gistId, pat);
      if (!isGistValid) {
        set({ syncError: 'Gist not found or inaccessible', isSyncing: false });
        return;
      }

      // Save session
      await saveSession({ pat, gistId });

      set({
        pat,
        gistId,
        isAuthenticated: true,
        isSyncing: false,
      });

      // Fetch data from Gist
      await get().sync();
    } catch (error) {
      set({
        syncError: error instanceof Error ? error.message : 'Failed to connect',
        isSyncing: false,
      });
    }
  },

  /**
   * Create new Gist and set up default profile/workspace
   * Requires network connection
   */
  setupWithNewGist: async (pat: string) => {
    set({ isSyncing: true, syncError: null });

    try {
      // Validate PAT is valid
      const isPatValid = await validatePat(pat);
      if (!isPatValid) {
        set({
          syncError: 'Invalid GitHub Personal Access Token',
          isSyncing: false,
        });
        return;
      }

      // Create new Gist (this validates write permissions)
      const gistId = await createNewGist(pat);

      // Create default profile
      const defaultProfile: Profile = {
        id: 'profile-Personal',
        name: 'Personal',
        createdAt: Date.now(),
        accentColor: DEFAULT_PROFILE_SETTINGS.accentColor,
      };

      // Create default workspace
      const workspaceFilename = generateWorkspaceFilename(
        'Personal',
        'Default'
      );
      const workspaceId = `ws-${workspaceFilename}`;
      const defaultWorkspace: WorkspaceMeta = {
        id: workspaceId,
        name: 'Default',
        profile: 'Personal',
        filename: workspaceFilename,
      };
      const defaultWorkspaceData: WorkspaceData = {
        id: workspaceId,
        name: 'Default',
        profile: 'Personal',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        links: [],
      };

      // Save to Gist
      await updateGistFile(
        gistId,
        workspaceFilename,
        serializeWorkspaceData(defaultWorkspaceData),
        pat
      );
      await saveProfileSettings(
        gistId,
        'Personal',
        {
          name: 'Personal',
          accentColor: DEFAULT_PROFILE_SETTINGS.accentColor,
          createdAt: defaultProfile.createdAt,
          workspaceOrder: [workspaceId],
        },
        pat
      );

      // Save session
      await saveSession({
        pat,
        gistId,
        activeProfileId: defaultProfile.id,
        activeWorkspaceId: workspaceId,
        profileWorkspaceMap: { [defaultProfile.id]: workspaceId },
      });

      // Save portable cache
      await savePortable({
        profiles: [defaultProfile],
        workspaces: [defaultWorkspace],
        workspaceDataCache: { [workspaceId]: defaultWorkspaceData },
      });

      set({
        // Session
        pat,
        gistId,
        activeProfileId: defaultProfile.id,
        activeWorkspaceId: workspaceId,
        profileWorkspaceMap: { [defaultProfile.id]: workspaceId },
        // Portable
        profiles: [defaultProfile],
        workspaces: [defaultWorkspace],
        workspaceDataCache: { [workspaceId]: defaultWorkspaceData },
        lastSyncedAt: Date.now(),
        // UI
        isAuthenticated: true,
        isSyncing: false,
        accentColor: DEFAULT_PROFILE_SETTINGS.accentColor,
      });
    } catch (error) {
      // Handle permission errors with a clearer message
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create Gist';
      const userMessage =
        errorMessage.includes('403') || errorMessage.includes('401')
          ? 'Missing Gist permissions. Ensure your token has read/write access to Gists.'
          : errorMessage;
      set({
        syncError: userMessage,
        isSyncing: false,
      });
    }
  },

  /**
   * Clear all local data and log out
   */
  clearCredentials: () => {
    clearAll();

    set({
      // Session
      pat: null,
      gistId: null,
      activeProfileId: null,
      activeWorkspaceId: null,
      profileWorkspaceMap: {},
      // Portable
      profiles: [],
      workspaces: [],
      workspaceDataCache: {},
      lastSyncedAt: null,
      // UI
      isAuthenticated: false,
      syncError: null,
    });
  },

  /**
   * Delete Gist from GitHub and log out
   */
  deleteGistAndLogout: async () => {
    const { pat, gistId } = get();

    if (pat && gistId) {
      try {
        await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'DELETE',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${pat}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
      } catch {
        // Continue with logout even if delete fails
      }
    }

    get().clearCredentials();
  },

  // ============================================================================
  // SYNC (non-blocking, warns on error)
  // ============================================================================

  /**
   * Background sync from Gist
   * - Fetches latest data from Gist
   * - Updates local cache
   * - Never blocks UI - just warns on error
   */
  sync: async () => {
    const { pat, gistId, activeProfileId, activeWorkspaceId } = get();

    if (!pat || !gistId) return;

    set({ isSyncing: true });

    try {
      // Validate PAT is still valid
      const isPatValid = await validatePat(pat);
      if (!isPatValid) {
        set({
          syncError: 'GitHub token expired or invalid',
          isSyncing: false,
          isAuthenticated: false,
        });
        return;
      }

      // Fetch Gist
      const gist = await fetchGist(gistId, pat);

      // Parse profiles and workspaces from filenames
      const profileSet = new Set<string>();
      const workspacesList: WorkspaceMeta[] = [];

      for (const [filename] of Object.entries(gist.files)) {
        if (!filename.endsWith('.json')) continue;

        // Check if it's a profile settings file
        const profileFromSettings = parseProfileSettingsFilename(filename);
        if (profileFromSettings) {
          profileSet.add(profileFromSettings);
          continue;
        }

        // Check if it's a workspace file
        const parsed = parseWorkspaceFilename(filename);
        if (!parsed) continue;

        profileSet.add(parsed.profile);
        workspacesList.push({
          id: `ws-${filename}`,
          name: parsed.workspace,
          profile: parsed.profile,
          filename,
        });
      }

      // Fetch profile settings to get accent colors
      const profileSettingsResults = await Promise.all(
        Array.from(profileSet).map(async (name) => {
          const settings = await fetchProfileSettings(gistId, name, pat);
          return { name, settings };
        })
      );
      const profileSettingsMap = new Map(
        profileSettingsResults.map(({ name, settings }) => [name, settings])
      );

      // Create profile objects
      const profiles: Profile[] = Array.from(profileSet).map((name) => {
        const settings = profileSettingsMap.get(name);
        return {
          id: `profile-${name}`,
          name,
          createdAt: settings?.createdAt || Date.now(),
          accentColor:
            settings?.accentColor || DEFAULT_PROFILE_SETTINGS.accentColor,
        };
      });

      // Ensure at least one profile exists
      if (profiles.length === 0) {
        profiles.push({
          id: 'profile-Personal',
          name: 'Personal',
          createdAt: Date.now(),
          accentColor: DEFAULT_PROFILE_SETTINGS.accentColor,
        });
      }

      // Fetch global settings and sort profiles by profileOrder
      const globalSettings = await fetchGlobalSettings(gistId, pat);
      const profileOrder = globalSettings.profileOrder || [];

      profiles.sort((a, b) => {
        const aIndex = profileOrder.indexOf(a.id);
        const bIndex = profileOrder.indexOf(b.id);
        // If both in order, sort by order
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        // If only a in order, a comes first
        if (aIndex !== -1) return -1;
        // If only b in order, b comes first
        if (bIndex !== -1) return 1;
        // Neither in order, sort alphabetically
        return a.name.localeCompare(b.name);
      });

      // Sort workspaces by profile's workspaceOrder
      const sortedWorkspaces: WorkspaceMeta[] = [];
      // Build pinnedLinksCache from profile settings
      const pinnedLinksCache: Record<string, PinnedLink[]> = {};
      for (const profile of profiles) {
        const settings = profileSettingsMap.get(profile.name);
        const order = settings?.workspaceOrder || [];
        const profileWs = workspacesList.filter(
          (w) => w.profile === profile.name
        );

        // Extract pinned links for this profile
        pinnedLinksCache[profile.id] = settings?.pinnedLinks || [];

        // Sort by order array, then alphabetically for any not in order
        profileWs.sort((a, b) => {
          const aIndex = order.indexOf(a.id);
          const bIndex = order.indexOf(b.id);
          // If both in order, sort by order
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          // If only a in order, a comes first
          if (aIndex !== -1) return -1;
          // If only b in order, b comes first
          if (bIndex !== -1) return 1;
          // Neither in order, sort alphabetically
          return a.name.localeCompare(b.name);
        });
        sortedWorkspaces.push(...profileWs);
      }

      // Find active workspace
      let activeProfile =
        profiles.find((p) => p.id === activeProfileId) || profiles[0];
      let activeWorkspace =
        sortedWorkspaces.find((w) => w.id === activeWorkspaceId) ||
        sortedWorkspaces.find((w) => w.profile === activeProfile.name);

      // Get current local cache for timestamp comparison
      const localCache = get().workspaceDataCache;

      // Load all workspace data and resolve conflicts using updatedAt timestamps
      const mergedCache: Record<string, WorkspaceData> = {};
      const workspacesToPush: { filename: string; data: WorkspaceData }[] = [];

      await Promise.all(
        sortedWorkspaces.map(async (ws) => {
          const file = gist.files[ws.filename];
          const localData = localCache[ws.id];

          if (!file) {
            // File doesn't exist on Gist - use local if available
            if (localData) {
              mergedCache[ws.id] = localData;
              workspacesToPush.push({ filename: ws.filename, data: localData });
            }
            return;
          }

          let content = file.content;
          if (!content || file.truncated) {
            content = await fetchGistFileContent(file.raw_url, pat);
          }
          const remoteData = parseWorkspaceData(content);

          if (!remoteData) {
            // Invalid remote data - use local if available
            if (localData) {
              mergedCache[ws.id] = localData;
            }
            return;
          }

          remoteData.id = ws.id;

          // Compare timestamps to resolve conflicts
          const localUpdatedAt = localData?.updatedAt || 0;
          const remoteUpdatedAt = remoteData.updatedAt || 0;

          if (localData && localUpdatedAt > remoteUpdatedAt) {
            // Local is newer - use local and push to Gist
            mergedCache[ws.id] = localData;
            workspacesToPush.push({ filename: ws.filename, data: localData });
            // Update workspace name from local data
            if (localData.name && localData.name !== ws.name) {
              ws.name = localData.name;
            }
          } else {
            // Remote is newer (or equal) - use remote
            mergedCache[ws.id] = remoteData;
            // Update workspace name from remote data
            if (remoteData.name && remoteData.name !== ws.name) {
              ws.name = remoteData.name;
            }
          }
        })
      );

      // Push local changes to Gist (non-blocking)
      if (workspacesToPush.length > 0) {
        Promise.all(
          workspacesToPush.map(({ filename, data }) =>
            updateGistFile(gistId, filename, serializeWorkspaceData(data), pat)
          )
        ).catch(() => {
          // Silently ignore push failures - will retry on next sync
        });
      }

      // Save to portable cache
      await savePortable({
        profiles,
        workspaces: sortedWorkspaces,
        workspaceDataCache: mergedCache,
        pinnedLinksCache,
      });

      // Update session with current selections
      await saveSession({
        activeProfileId: activeProfile.id,
        activeWorkspaceId: activeWorkspace?.id || null,
      });

      set({
        profiles,
        workspaces: sortedWorkspaces,
        workspaceDataCache: mergedCache,
        pinnedLinksCache,
        activeProfileId: activeProfile.id,
        activeWorkspaceId: activeWorkspace?.id || null,
        accentColor: activeProfile.accentColor || 'gray',
        lastSyncedAt: Date.now(),
        isSyncing: false,
        syncError: null,
      });
    } catch (error) {
      // Non-blocking: just warn, don't break the experience
      set({
        syncError: error instanceof Error ? error.message : 'Sync failed',
        isSyncing: false,
      });
    }
  },

  // ============================================================================
  // NAVIGATION (offline-capable)
  // ============================================================================

  /**
   * Switch to a different profile
   * Works offline - uses cached data
   */
  switchProfile: (profileId: string) => {
    const {
      profiles,
      workspaces,
      profileWorkspaceMap,
      workspaceDataCache,
      pinnedLinksCache,
    } = get();
    const profile = profiles.find((p) => p.id === profileId);

    if (!profile) return;

    // Find last workspace for this profile, or first workspace
    const lastWorkspaceId = profileWorkspaceMap[profileId];
    let targetWorkspace = lastWorkspaceId
      ? workspaces.find(
          (w) => w.id === lastWorkspaceId && w.profile === profile.name
        )
      : null;

    if (!targetWorkspace) {
      targetWorkspace = workspaces.find((w) => w.profile === profile.name);
    }

    set({
      activeProfileId: profileId,
      activeWorkspaceId: targetWorkspace?.id || null,
      accentColor: profile.accentColor || 'gray',
    });

    // Save session (don't await)
    saveSession({
      activeProfileId: profileId,
      activeWorkspaceId: targetWorkspace?.id || null,
    });

    // Switch pinned tabs to match the new profile
    const profilePinnedLinks = pinnedLinksCache[profileId] || [];
    switchPinnedTabs(
      profilePinnedLinks.map((link) => ({
        url: link.url,
        title: link.title,
        pinned: true,
      }))
    );

    // Switch to workspace (this handles tab switching)
    if (targetWorkspace) {
      // Switch tabs to match workspace
      const cachedData = workspaceDataCache[targetWorkspace.id];
      if (cachedData) {
        switchWorkspaceTabs(
          cachedData.links.map((link) => ({
            url: link.url,
            title: link.title,
            pinned: link.pinned,
          })),
          get().memorySaverMode
        );
      } else {
        // Load workspace data if not cached (this will also switch tabs)
        get().switchWorkspace(targetWorkspace.id);
      }
    } else {
      // No workspace - close all tabs
      switchWorkspaceTabs([], get().memorySaverMode);
    }
  },

  /**
   * Switch to a different workspace
   * Loads from cache first, then fetches if needed
   */
  switchWorkspace: async (workspaceId: string) => {
    const {
      workspaces,
      workspaceDataCache,
      pat,
      gistId,
      activeProfileId,
      profileWorkspaceMap,
    } = get();
    const workspace = workspaces.find((w) => w.id === workspaceId);

    if (!workspace) return;

    // Update profile workspace map
    const newMap = { ...profileWorkspaceMap };
    if (activeProfileId) {
      newMap[activeProfileId] = workspaceId;
    }

    // Check cache first (instant, offline)
    if (workspaceDataCache[workspaceId]) {
      set({
        activeWorkspaceId: workspaceId,
        profileWorkspaceMap: newMap,
      });
      saveSession({
        activeWorkspaceId: workspaceId,
        profileWorkspaceMap: newMap,
      });

      // Switch tabs to match workspace
      const cachedData = workspaceDataCache[workspaceId];
      switchWorkspaceTabs(
        cachedData.links.map((link) => ({
          url: link.url,
          title: link.title,
          pinned: link.pinned,
        })),
        get().memorySaverMode
      );

      return;
    }

    // Not cached - need to fetch (requires network)
    if (!pat || !gistId) {
      // Offline and not cached - create empty workspace
      const emptyData: WorkspaceData = {
        id: workspaceId,
        name: workspace.name,
        profile: workspace.profile,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        links: [],
      };
      set((state) => ({
        activeWorkspaceId: workspaceId,
        profileWorkspaceMap: newMap,
        workspaceDataCache: {
          ...state.workspaceDataCache,
          [workspaceId]: emptyData,
        },
      }));

      // Close all tabs (empty workspace)
      switchWorkspaceTabs([], get().memorySaverMode);

      return;
    }

    try {
      const gist = await fetchGist(gistId, pat);
      const file = gist.files[workspace.filename];

      if (!file) {
        // File doesn't exist - create empty workspace
        const emptyData: WorkspaceData = {
          id: workspaceId,
          name: workspace.name,
          profile: workspace.profile,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          links: [],
        };
        set((state) => ({
          activeWorkspaceId: workspaceId,
          profileWorkspaceMap: newMap,
          workspaceDataCache: {
            ...state.workspaceDataCache,
            [workspaceId]: emptyData,
          },
        }));

        // Close all tabs (empty workspace)
        switchWorkspaceTabs([], get().memorySaverMode);

        return;
      }

      let content = file.content;
      if (!content || file.truncated) {
        content = await fetchGistFileContent(file.raw_url, pat);
      }

      const workspaceData = parseWorkspaceData(content);
      if (!workspaceData) {
        throw new Error('Invalid workspace data');
      }
      workspaceData.id = workspaceId;

      // Update cache and workspace name (may differ from filename)
      set((state) => ({
        activeWorkspaceId: workspaceId,
        profileWorkspaceMap: newMap,
        workspaceDataCache: {
          ...state.workspaceDataCache,
          [workspaceId]: workspaceData,
        },
        workspaces:
          workspaceData.name && workspaceData.name !== workspace.name
            ? state.workspaces.map((w) =>
                w.id === workspaceId ? { ...w, name: workspaceData.name } : w
              )
            : state.workspaces,
      }));

      // Save to portable cache
      const { profiles, workspaces, workspaceDataCache: updatedCache } = get();
      await savePortable({
        profiles,
        workspaces,
        workspaceDataCache: { ...updatedCache, [workspaceId]: workspaceData },
      });

      saveSession({
        activeWorkspaceId: workspaceId,
        profileWorkspaceMap: newMap,
      });

      // Switch tabs to match workspace
      switchWorkspaceTabs(
        workspaceData.links.map((link) => ({
          url: link.url,
          title: link.title,
          pinned: link.pinned,
        })),
        get().memorySaverMode
      );
    } catch (error) {
      set({
        syncError:
          error instanceof Error ? error.message : 'Failed to load workspace',
      });
    }
  },

  // ============================================================================
  // PROFILE CRUD (optimistic, sync in background)
  // ============================================================================

  createProfile: async (name: string) => {
    const { pat, gistId, accentColor } = get();

    const newProfile: Profile = {
      id: `profile-${name}`,
      name,
      createdAt: Date.now(),
      accentColor: accentColor,
    };

    // Create default workspace
    const workspaceFilename = generateWorkspaceFilename(name, 'Default');
    const workspaceId = `ws-${workspaceFilename}`;
    const newWorkspace: WorkspaceMeta = {
      id: workspaceId,
      name: 'Default',
      profile: name,
      filename: workspaceFilename,
    };
    const newWorkspaceData: WorkspaceData = {
      id: workspaceId,
      name: 'Default',
      profile: name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      links: [],
    };

    // Optimistic update
    set((state) => ({
      profiles: [...state.profiles, newProfile],
      workspaces: [...state.workspaces, newWorkspace],
      workspaceDataCache: {
        ...state.workspaceDataCache,
        [workspaceId]: newWorkspaceData,
      },
      activeProfileId: newProfile.id,
      activeWorkspaceId: workspaceId,
      profileWorkspaceMap: {
        ...state.profileWorkspaceMap,
        [newProfile.id]: workspaceId,
      },
    }));

    // Save session
    saveSession({
      activeProfileId: newProfile.id,
      activeWorkspaceId: workspaceId,
      profileWorkspaceMap: {
        ...get().profileWorkspaceMap,
        [newProfile.id]: workspaceId,
      },
    });

    // Sync to Gist (non-blocking)
    if (pat && gistId) {
      try {
        await updateGistFile(
          gistId,
          workspaceFilename,
          serializeWorkspaceData(newWorkspaceData),
          pat
        );
        await saveProfileSettings(
          gistId,
          name,
          {
            name,
            accentColor,
            createdAt: newProfile.createdAt,
            workspaceOrder: [workspaceId],
          },
          pat
        );

        // Update global settings with new profile in order
        const allProfiles = get().profiles;
        const profileOrder = allProfiles.map((p) => p.id);
        saveGlobalSettings(
          gistId,
          {
            version: 1,
            profileOrder,
            updatedAt: Date.now(),
          },
          pat
        ).catch(() => {
          // Silently ignore - order sync is not critical
        });
      } catch (error) {
        set({ syncError: 'Failed to sync new profile' });
        console.error(error instanceof Error ? error.message : error);
      }
    }

    // Update portable cache
    const { profiles, workspaces, workspaceDataCache } = get();
    savePortable({ profiles, workspaces, workspaceDataCache });
  },

  deleteProfile: async (profileId: string) => {
    const {
      profiles,
      workspaces,
      activeProfileId,
      pat,
      gistId,
      workspaceDataCache,
    } = get();
    const profile = profiles.find((p) => p.id === profileId);

    if (!profile) return;

    const workspacesToDelete = workspaces.filter(
      (w) => w.profile === profile.name
    );
    const remainingWorkspaces = workspaces.filter(
      (w) => w.profile !== profile.name
    );
    const remainingProfiles = profiles.filter((p) => p.id !== profileId);

    // Clean up workspace cache
    const newCache = { ...workspaceDataCache };
    workspacesToDelete.forEach((w) => delete newCache[w.id]);

    // Select new active profile
    const newActiveProfile =
      activeProfileId === profileId
        ? remainingProfiles[0]
        : profiles.find((p) => p.id === activeProfileId);

    // Optimistic update
    set({
      profiles: remainingProfiles,
      workspaces: remainingWorkspaces,
      workspaceDataCache: newCache,
      activeProfileId: newActiveProfile?.id || null,
    });

    // Switch to new profile
    if (newActiveProfile && newActiveProfile.id !== activeProfileId) {
      get().switchProfile(newActiveProfile.id);
    }

    // Sync deletions to Gist (non-blocking)
    if (pat && gistId) {
      for (const workspace of workspacesToDelete) {
        try {
          await deleteGistFile(gistId, workspace.filename, pat);
        } catch {
          /* continue */
        }
      }
      try {
        await deleteGistFile(
          gistId,
          generateProfileSettingsFilename(profile.name),
          pat
        );
      } catch {
        /* continue */
      }

      // Update global settings (remove profile from order)
      const profileOrder = remainingProfiles.map((p) => p.id);
      saveGlobalSettings(
        gistId,
        {
          version: 1,
          profileOrder,
          updatedAt: Date.now(),
        },
        pat
      ).catch(() => {
        // Silently ignore - order sync is not critical
      });
    }

    // Update portable cache
    savePortable({
      profiles: remainingProfiles,
      workspaces: remainingWorkspaces,
      workspaceDataCache: newCache,
    });
  },

  reorderProfiles: (oldIndex: number, newIndex: number) => {
    const { profiles, workspaces, workspaceDataCache, pat, gistId } = get();

    // Reorder profiles array
    const reordered = [...profiles];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    set({ profiles: reordered });

    // Save to portable cache immediately
    savePortable({ profiles: reordered, workspaces, workspaceDataCache });

    // Sync profile order to Gist (non-blocking)
    if (pat && gistId) {
      const profileOrder = reordered.map((p) => p.id);
      saveGlobalSettings(
        gistId,
        {
          version: 1,
          profileOrder,
          updatedAt: Date.now(),
        },
        pat
      ).catch(() => {
        // Silently ignore - order sync is not critical
      });
    }
  },

  renameProfile: async (profileId: string, newName: string) => {
    const { profiles, workspaces, workspaceDataCache, pat, gistId } = get();
    const profile = profiles.find((p) => p.id === profileId);

    if (!profile || !newName.trim() || newName === profile.name) return;

    const oldName = profile.name;
    const trimmedName = newName.trim();

    // Update profile name
    const updatedProfiles = profiles.map((p) =>
      p.id === profileId ? { ...p, name: trimmedName } : p
    );

    // Update workspaces to reference new profile name + new filenames
    const updatedWorkspaces = workspaces.map((w) => {
      if (w.profile === oldName) {
        const newFilename = generateWorkspaceFilename(trimmedName, w.name);
        return { ...w, profile: trimmedName, filename: newFilename };
      }
      return w;
    });

    // Update workspace cache with new IDs
    const newCache: Record<string, WorkspaceData> = {};
    for (const [oldId, data] of Object.entries(workspaceDataCache)) {
      const workspace = workspaces.find((w) => w.id === oldId);
      if (workspace && workspace.profile === oldName) {
        const newFilename = generateWorkspaceFilename(
          trimmedName,
          workspace.name
        );
        const newId = `ws-${newFilename}`;
        newCache[newId] = { ...data, id: newId, profile: trimmedName };
      } else {
        newCache[oldId] = data;
      }
    }

    // Optimistic update
    set({
      profiles: updatedProfiles,
      workspaces: updatedWorkspaces,
      workspaceDataCache: newCache,
    });

    // Save to portable cache
    savePortable({
      profiles: updatedProfiles,
      workspaces: updatedWorkspaces,
      workspaceDataCache: newCache,
    });

    // Sync to Gist (non-blocking)
    if (pat && gistId) {
      try {
        // 1. Create new profile settings file
        const profile = updatedProfiles.find((p) => p.id === profileId);
        if (profile) {
          await saveProfileSettings(
            gistId,
            trimmedName,
            {
              name: trimmedName,
              accentColor: profile.accentColor,
              createdAt: profile.createdAt,
              workspaceOrder: updatedWorkspaces
                .filter((w) => w.profile === trimmedName)
                .map((w) => w.id),
            },
            pat
          );
        }

        // 2. Delete old profile settings file
        await deleteGistFile(
          gistId,
          generateProfileSettingsFilename(oldName),
          pat
        ).catch(() => {
          /* ignore */
        });

        // 3. Create new workspace files and delete old ones
        const profileWorkspaces = workspaces.filter(
          (w) => w.profile === oldName
        );
        for (const ws of profileWorkspaces) {
          const oldFilename = ws.filename;
          const newFilename = generateWorkspaceFilename(trimmedName, ws.name);
          const data = workspaceDataCache[ws.id];

          if (data) {
            // Create new workspace file
            await updateGistFile(
              gistId,
              newFilename,
              serializeWorkspaceData({ ...data, profile: trimmedName }),
              pat
            );
          }

          // Delete old workspace file
          await deleteGistFile(gistId, oldFilename, pat).catch(() => {
            /* ignore */
          });
        }
      } catch {
        // Error handling - could rollback or retry
      }
    }
  },

  // ============================================================================
  // WORKSPACE CRUD (optimistic, sync in background)
  // ============================================================================

  createWorkspace: async (name: string, initialLinks?: Array<{ url: string; title: string; favicon?: string }>) => {
    const { profiles, activeProfileId, pat, gistId } = get();
    const profile = profiles.find((p) => p.id === activeProfileId);

    if (!profile) return;

    const filename = generateWorkspaceFilename(profile.name, name);
    const workspaceId = `ws-${filename}`;

    // Convert initial links to LinkItems with IDs
    const links: LinkItem[] = (initialLinks || []).map((link) => ({
      id: nanoid(),
      url: link.url,
      title: link.title,
      favicon: link.favicon,
      pinned: false,
    }));

    const newWorkspace: WorkspaceMeta = {
      id: workspaceId,
      name,
      profile: profile.name,
      filename,
    };
    const newWorkspaceData: WorkspaceData = {
      id: workspaceId,
      name,
      profile: profile.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      links,
    };

    // Optimistic update
    set((state) => ({
      workspaces: [...state.workspaces, newWorkspace],
      workspaceDataCache: {
        ...state.workspaceDataCache,
        [workspaceId]: newWorkspaceData,
      },
      activeWorkspaceId: workspaceId,
      profileWorkspaceMap: {
        ...state.profileWorkspaceMap,
        [profile.id]: workspaceId,
      },
    }));

    saveSession({
      activeWorkspaceId: workspaceId,
      profileWorkspaceMap: {
        ...get().profileWorkspaceMap,
        [profile.id]: workspaceId,
      },
    });

    // Sync to Gist (non-blocking)
    if (pat && gistId) {
      try {
        await updateGistFile(
          gistId,
          filename,
          serializeWorkspaceData(newWorkspaceData),
          pat
        );

        // Add new workspace to order array
        const profileWorkspaces = get().workspaces.filter(
          (w) => w.profile === profile.name
        );
        const workspaceOrder = profileWorkspaces.map((w) => w.id);
        saveProfileSettings(
          gistId,
          profile.name,
          {
            name: profile.name,
            accentColor: profile.accentColor,
            createdAt: profile.createdAt,
            workspaceOrder,
          },
          pat
        ).catch(() => {
          // Silently ignore - order sync is not critical
        });
      } catch {
        set({ syncError: 'Failed to sync new workspace' });
      }
    }

    // Update portable cache
    const { profiles: p, workspaces, workspaceDataCache } = get();
    savePortable({ profiles: p, workspaces, workspaceDataCache });
  },

  deleteWorkspace: async (workspaceId: string) => {
    const {
      workspaces,
      activeWorkspaceId,
      activeProfileId,
      profiles,
      pat,
      gistId,
      workspaceDataCache,
    } = get();
    const workspace = workspaces.find((w) => w.id === workspaceId);

    if (!workspace) return;

    const profile = profiles.find((p) => p.id === activeProfileId);
    const remainingWorkspaces = workspaces.filter((w) => w.id !== workspaceId);
    const newActiveWorkspace =
      activeWorkspaceId === workspaceId
        ? remainingWorkspaces.find((w) => w.profile === profile?.name)
        : workspaces.find((w) => w.id === activeWorkspaceId);

    // Clean up cache
    const newCache = { ...workspaceDataCache };
    delete newCache[workspaceId];

    // Optimistic update
    set({
      workspaces: remainingWorkspaces,
      workspaceDataCache: newCache,
      activeWorkspaceId: newActiveWorkspace?.id || null,
    });

    // Sync deletion to Gist (non-blocking)
    if (pat && gistId && profile) {
      try {
        await deleteGistFile(gistId, workspace.filename, pat);

        // Update workspace order (remove deleted workspace)
        const profileWorkspaces = remainingWorkspaces.filter(
          (w) => w.profile === profile.name
        );
        const workspaceOrder = profileWorkspaces.map((w) => w.id);
        saveProfileSettings(
          gistId,
          profile.name,
          {
            name: profile.name,
            accentColor: profile.accentColor,
            createdAt: profile.createdAt,
            workspaceOrder,
          },
          pat
        ).catch(() => {
          // Silently ignore - order sync is not critical
        });
      } catch {
        /* continue */
      }
    }

    // Update portable cache
    savePortable({
      profiles,
      workspaces: remainingWorkspaces,
      workspaceDataCache: newCache,
    });

    // Load new active workspace if needed
    if (newActiveWorkspace && !newCache[newActiveWorkspace.id]) {
      get().switchWorkspace(newActiveWorkspace.id);
    }
  },

  renameWorkspace: async (workspaceId: string, newName: string) => {
    const { workspaceDataCache, profiles, workspaces, pat, gistId } = get();
    const workspace = workspaces.find((w) => w.id === workspaceId);

    if (!workspace) return;

    // Optimistic update with updatedAt
    const now = Date.now();
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, name: newName } : w
      ),
      workspaceDataCache: workspaceDataCache[workspaceId]
        ? {
            ...state.workspaceDataCache,
            [workspaceId]: {
              ...workspaceDataCache[workspaceId],
              name: newName,
              updatedAt: now,
            },
          }
        : state.workspaceDataCache,
    }));

    // Save to portable cache immediately
    const { workspaces: updatedWorkspaces, workspaceDataCache: updatedCache } =
      get();
    savePortable({
      profiles,
      workspaces: updatedWorkspaces,
      workspaceDataCache: updatedCache,
    });

    // Sync to Gist immediately (not debounced) so other tabs see the new name
    if (pat && gistId && updatedCache[workspaceId]) {
      try {
        await updateGistFile(
          gistId,
          workspace.filename,
          serializeWorkspaceData(updatedCache[workspaceId]),
          pat
        );
      } catch {
        set({ syncError: 'Failed to save rename to cloud' });
      }
    }
  },

  reorderWorkspaces: (oldIndex: number, newIndex: number) => {
    const { workspaces, profiles, activeProfileId, pat, gistId } = get();
    const activeProfile = profiles.find((p) => p.id === activeProfileId);

    if (!activeProfile) return;

    // Separate workspaces by profile
    const profileWorkspaces = workspaces.filter(
      (w) => w.profile === activeProfile.name
    );
    const otherWorkspaces = workspaces.filter(
      (w) => w.profile !== activeProfile.name
    );

    // Reorder the profile's workspaces
    const reordered = [...profileWorkspaces];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Combine back: profile workspaces first (in new order), then others
    const newWorkspaces = [...reordered, ...otherWorkspaces];

    set({ workspaces: newWorkspaces });

    // Save to portable cache
    const { workspaceDataCache } = get();
    savePortable({ profiles, workspaces: newWorkspaces, workspaceDataCache });

    // Sync workspace order to Gist (non-blocking)
    if (pat && gistId) {
      const workspaceOrder = reordered.map((w) => w.id);
      saveProfileSettings(
        gistId,
        activeProfile.name,
        {
          name: activeProfile.name,
          accentColor: activeProfile.accentColor,
          createdAt: activeProfile.createdAt,
          workspaceOrder,
        },
        pat
      ).catch(() => {
        // Silently ignore - order sync is not critical
      });
    }
  },

  // ============================================================================
  // LINK CRUD (optimistic, debounced sync)
  // ============================================================================

  addLink: (url: string, title: string, favicon?: string) => {
    const { activeWorkspaceId, workspaceDataCache, profiles, workspaces } =
      get();
    if (!activeWorkspaceId || !workspaceDataCache[activeWorkspaceId])
      return undefined;

    const linkId = nanoid();
    const newLink: LinkItem = {
      id: linkId,
      url,
      title,
      favicon,
      pinned: false,
    };

    const currentData = workspaceDataCache[activeWorkspaceId];
    const updatedData = {
      ...currentData,
      links: [...currentData.links, newLink],
      updatedAt: Date.now(),
    };

    set((state) => ({
      workspaceDataCache: {
        ...state.workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    }));

    // Open the tab if not already open (inactive, not pinned)
    chrome.tabs.query({ url }).then((tabs) => {
      if (tabs.length === 0) {
        chrome.tabs.create({ url, active: false }).catch(() => {});
      }
    }).catch(() => {});

    // Save to portable cache immediately
    savePortable({
      profiles,
      workspaces,
      workspaceDataCache: {
        ...workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    });

    // Queue debounced sync to Gist
    get().saveWorkspace();

    return linkId;
  },

  removeLink: (linkId: string) => {
    const { activeWorkspaceId, workspaceDataCache, profiles, workspaces } =
      get();
    if (!activeWorkspaceId || !workspaceDataCache[activeWorkspaceId]) return;

    const currentData = workspaceDataCache[activeWorkspaceId];
    const linkToRemove = currentData.links.find((l) => l.id === linkId);
    const updatedData = {
      ...currentData,
      links: currentData.links.filter((l) => l.id !== linkId),
      updatedAt: Date.now(),
    };

    set((state) => ({
      workspaceDataCache: {
        ...state.workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    }));

    // Close the tab if it's open (non-pinned only)
    if (linkToRemove) {
      chrome.tabs.query({ url: linkToRemove.url, pinned: false }).then((tabs) => {
        const tab = tabs[0];
        if (tab?.id) {
          chrome.tabs.remove(tab.id).catch(() => {});
        }
      }).catch(() => {});
    }

    // Save to portable cache immediately
    savePortable({
      profiles,
      workspaces,
      workspaceDataCache: {
        ...workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    });

    // Queue debounced sync to Gist
    get().saveWorkspace();
  },

  replaceAllLinks: (links: Array<{ url: string; title: string; favicon?: string }>) => {
    const { activeWorkspaceId, workspaceDataCache, profiles, workspaces } =
      get();
    if (!activeWorkspaceId || !workspaceDataCache[activeWorkspaceId]) return;

    // Convert to LinkItems with IDs
    const newLinks: LinkItem[] = links.map((link) => ({
      id: nanoid(),
      url: link.url,
      title: link.title,
      favicon: link.favicon,
      pinned: false,
    }));

    const currentData = workspaceDataCache[activeWorkspaceId];
    const oldLinks = currentData.links;
    const updatedData = {
      ...currentData,
      links: newLinks,
      updatedAt: Date.now(),
    };

    set((state) => ({
      workspaceDataCache: {
        ...state.workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    }));

    // Close tabs for removed links (non-pinned only)
    const newUrls = new Set(newLinks.map((l) => l.url));
    oldLinks.forEach((link) => {
      if (!newUrls.has(link.url)) {
        chrome.tabs.query({ url: link.url, pinned: false }).then((tabs) => {
          const tab = tabs[0];
          if (tab?.id) {
            chrome.tabs.remove(tab.id).catch(() => {});
          }
        }).catch(() => {});
      }
    });

    // Open tabs for new links that aren't already open
    const oldUrls = new Set(oldLinks.map((l) => l.url));
    newLinks.forEach((link) => {
      if (!oldUrls.has(link.url)) {
        chrome.tabs.query({ url: link.url }).then((tabs) => {
          if (tabs.length === 0) {
            chrome.tabs.create({ url: link.url, active: false }).catch(() => {});
          }
        }).catch(() => {});
      }
    });

    // Save to portable cache immediately
    savePortable({
      profiles,
      workspaces,
      workspaceDataCache: {
        ...workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    });

    // Queue debounced sync to Gist
    get().saveWorkspace();
  },

  updateLink: (linkId: string, updates: Partial<LinkItem>) => {
    const { activeWorkspaceId, workspaceDataCache, profiles, workspaces } =
      get();
    if (!activeWorkspaceId || !workspaceDataCache[activeWorkspaceId]) return;

    const currentData = workspaceDataCache[activeWorkspaceId];
    const updatedData = {
      ...currentData,
      links: currentData.links.map((l) =>
        l.id === linkId ? { ...l, ...updates } : l
      ),
      updatedAt: Date.now(),
    };

    set((state) => ({
      workspaceDataCache: {
        ...state.workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    }));

    // Save to portable cache immediately
    savePortable({
      profiles,
      workspaces,
      workspaceDataCache: {
        ...workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    });

    // Queue debounced sync to Gist
    get().saveWorkspace();
  },

  togglePinLink: (linkId: string) => {
    const { activeWorkspaceId, workspaceDataCache, profiles, workspaces } =
      get();
    if (!activeWorkspaceId || !workspaceDataCache[activeWorkspaceId]) return;

    const currentData = workspaceDataCache[activeWorkspaceId];
    const updatedData = {
      ...currentData,
      links: currentData.links.map((l) =>
        l.id === linkId ? { ...l, pinned: !l.pinned } : l
      ),
      updatedAt: Date.now(),
    };

    set((state) => ({
      workspaceDataCache: {
        ...state.workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    }));

    // Save to portable cache immediately
    savePortable({
      profiles,
      workspaces,
      workspaceDataCache: {
        ...workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    });

    // Queue debounced sync to Gist
    get().saveWorkspace();
  },

  reorderLinks: (oldIndex: number, newIndex: number) => {
    const { activeWorkspaceId, workspaceDataCache, profiles, workspaces } =
      get();
    if (!activeWorkspaceId || !workspaceDataCache[activeWorkspaceId]) return;

    const currentData = workspaceDataCache[activeWorkspaceId];
    const links = [...currentData.links];
    const [removed] = links.splice(oldIndex, 1);
    links.splice(newIndex, 0, removed);

    const updatedData = { ...currentData, links, updatedAt: Date.now() };

    set((state) => ({
      workspaceDataCache: {
        ...state.workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    }));

    // Save to portable cache immediately
    savePortable({
      profiles,
      workspaces,
      workspaceDataCache: {
        ...workspaceDataCache,
        [activeWorkspaceId]: updatedData,
      },
    });

    // Queue debounced sync to Gist
    get().saveWorkspace();
  },

  /**
   * Populate missing title/favicon for links matching a URL
   * Called when a tab finishes loading - only fills empty fields, never overwrites
   */
  populateMissingTabData: (tabUrl: string, title: string | undefined, faviconUrl: string | undefined) => {
    const {
      activeWorkspaceId,
      activeProfileId,
      workspaceDataCache,
      pinnedLinksCache,
      profiles,
      workspaces,
      pat,
      gistId,
    } = get();

    let workspaceUpdated = false;
    let pinnedUpdated = false;

    // Check workspace links
    if (activeWorkspaceId && workspaceDataCache[activeWorkspaceId]) {
      const currentData = workspaceDataCache[activeWorkspaceId];
      const updatedLinks = currentData.links.map((link) => {
        // Only populate if URL matches and title/favicon is empty
        if (link.url === tabUrl) {
          const needsTitle = title && !link.title;
          const needsFavicon = faviconUrl && !link.favicon;
          if (needsTitle || needsFavicon) {
            workspaceUpdated = true;
            return {
              ...link,
              ...(needsTitle ? { title } : {}),
              ...(needsFavicon ? { favicon: faviconUrl } : {}),
            };
          }
        }
        return link;
      });

      if (workspaceUpdated) {
        const updatedData = { ...currentData, links: updatedLinks, updatedAt: Date.now() };
        set((state) => ({
          workspaceDataCache: {
            ...state.workspaceDataCache,
            [activeWorkspaceId]: updatedData,
          },
        }));

        // Save to portable cache
        savePortable({
          profiles,
          workspaces,
          workspaceDataCache: {
            ...workspaceDataCache,
            [activeWorkspaceId]: updatedData,
          },
          pinnedLinksCache,
        });

        // Queue debounced sync
        get().saveWorkspace();
      }
    }

    // Check pinned links
    if (activeProfileId && pinnedLinksCache[activeProfileId]) {
      const profile = profiles.find((p) => p.id === activeProfileId);
      const currentLinks = pinnedLinksCache[activeProfileId];
      const updatedLinks = currentLinks.map((link) => {
        // Only populate if URL matches and title/favicon is empty
        if (link.url === tabUrl) {
          const needsTitle = title && !link.title;
          const needsFavicon = faviconUrl && !link.favicon;
          if (needsTitle || needsFavicon) {
            pinnedUpdated = true;
            return {
              ...link,
              ...(needsTitle ? { title } : {}),
              ...(needsFavicon ? { favicon: faviconUrl } : {}),
            };
          }
        }
        return link;
      });

      if (pinnedUpdated && profile) {
        set((state) => ({
          pinnedLinksCache: {
            ...state.pinnedLinksCache,
            [activeProfileId]: updatedLinks,
          },
        }));

        // Save to portable cache
        savePortable({
          profiles,
          workspaces,
          workspaceDataCache,
          pinnedLinksCache: {
            ...pinnedLinksCache,
            [activeProfileId]: updatedLinks,
          },
        });

        // Save to profile settings
        if (pat && gistId) {
          saveProfileSettings(gistId, profile.name, { pinnedLinks: updatedLinks }, pat).catch(
            () => {}
          );
        }
      }
    }
  },

  // ============================================================================
  // PINNED LINKS CRUD (per profile, synced to profile settings)
  // ============================================================================

  addPinnedLink: (url: string, title: string, favicon?: string) => {
    const { activeProfileId, pinnedLinksCache, profiles, pat, gistId } = get();
    if (!activeProfileId) return undefined;

    const profile = profiles.find((p) => p.id === activeProfileId);
    if (!profile) return undefined;

    const id = nanoid();
    const newLink: PinnedLink = { id, url, title, favicon };
    const currentLinks = pinnedLinksCache[activeProfileId] || [];
    const updatedLinks = [...currentLinks, newLink];

    set((state) => ({
      pinnedLinksCache: {
        ...state.pinnedLinksCache,
        [activeProfileId]: updatedLinks,
      },
    }));

    // Open the tab as pinned
    chrome.tabs.create({ url, pinned: true, active: false }).catch(() => {
      // Silently ignore - tab creation is non-critical
    });

    // Save to profile settings (background, non-blocking)
    if (pat && gistId) {
      saveProfileSettings(gistId, profile.name, { pinnedLinks: updatedLinks }, pat).catch(() => {
        // Silently ignore - will retry on next sync
      });
    }

    return id;
  },

  removePinnedLink: (linkId: string) => {
    const { activeProfileId, pinnedLinksCache, profiles, pat, gistId } = get();
    if (!activeProfileId) return;

    const profile = profiles.find((p) => p.id === activeProfileId);
    if (!profile) return;

    const currentLinks = pinnedLinksCache[activeProfileId] || [];
    const linkToRemove = currentLinks.find((link) => link.id === linkId);
    const updatedLinks = currentLinks.filter((link) => link.id !== linkId);

    set((state) => ({
      pinnedLinksCache: {
        ...state.pinnedLinksCache,
        [activeProfileId]: updatedLinks,
      },
    }));

    // Close the pinned tab
    if (linkToRemove) {
      chrome.tabs.query({ pinned: true }).then((tabs) => {
        const tab = tabs.find((t) => t.url === linkToRemove.url);
        if (tab?.id) {
          chrome.tabs.remove(tab.id).catch(() => {});
        }
      }).catch(() => {});
    }

    // Save to profile settings (background, non-blocking)
    if (pat && gistId) {
      saveProfileSettings(gistId, profile.name, { pinnedLinks: updatedLinks }, pat).catch(() => {
        // Silently ignore
      });
    }
  },

  updatePinnedLink: (linkId: string, updates: Partial<PinnedLink>) => {
    const { activeProfileId, pinnedLinksCache, profiles, pat, gistId } = get();
    if (!activeProfileId) return;

    const profile = profiles.find((p) => p.id === activeProfileId);
    if (!profile) return;

    const currentLinks = pinnedLinksCache[activeProfileId] || [];
    const updatedLinks = currentLinks.map((link) =>
      link.id === linkId ? { ...link, ...updates } : link
    );

    set((state) => ({
      pinnedLinksCache: {
        ...state.pinnedLinksCache,
        [activeProfileId]: updatedLinks,
      },
    }));

    // Save to profile settings (background, non-blocking)
    if (pat && gistId) {
      saveProfileSettings(gistId, profile.name, { pinnedLinks: updatedLinks }, pat).catch(() => {
        // Silently ignore
      });
    }
  },

  reorderPinnedLinks: (oldIndex: number, newIndex: number) => {
    const { activeProfileId, pinnedLinksCache, profiles, pat, gistId } = get();
    if (!activeProfileId) return;

    const profile = profiles.find((p) => p.id === activeProfileId);
    if (!profile) return;

    const currentLinks = [...(pinnedLinksCache[activeProfileId] || [])];
    const [removed] = currentLinks.splice(oldIndex, 1);
    currentLinks.splice(newIndex, 0, removed);

    set((state) => ({
      pinnedLinksCache: {
        ...state.pinnedLinksCache,
        [activeProfileId]: currentLinks,
      },
    }));

    // Save to profile settings (background, non-blocking)
    if (pat && gistId) {
      saveProfileSettings(gistId, profile.name, { pinnedLinks: currentLinks }, pat).catch(() => {
        // Silently ignore
      });
    }
  },

  moveLinkToPinned: (linkId: string) => {
    const {
      activeProfileId,
      activeWorkspaceId,
      workspaceDataCache,
      pinnedLinksCache,
      profiles,
      workspaces,
      pat,
      gistId,
    } = get();
    if (!activeProfileId || !activeWorkspaceId) return;
    if (!workspaceDataCache[activeWorkspaceId]) return;

    const profile = profiles.find((p) => p.id === activeProfileId);
    if (!profile) return;

    const currentData = workspaceDataCache[activeWorkspaceId];
    const linkToMove = currentData.links.find((link) => link.id === linkId);
    if (!linkToMove) return;

    // Create pinned link from workspace link
    const pinnedLink: PinnedLink = {
      id: nanoid(),
      url: linkToMove.url,
      title: linkToMove.title,
      favicon: linkToMove.favicon,
    };

    // Remove from workspace
    const updatedWorkspaceLinks = currentData.links.filter(
      (link) => link.id !== linkId
    );
    const updatedWorkspaceData = {
      ...currentData,
      links: updatedWorkspaceLinks,
      updatedAt: Date.now(),
    };

    // Add to pinned links
    const currentPinnedLinks = pinnedLinksCache[activeProfileId] || [];
    const updatedPinnedLinks = [...currentPinnedLinks, pinnedLink];

    set((state) => ({
      workspaceDataCache: {
        ...state.workspaceDataCache,
        [activeWorkspaceId]: updatedWorkspaceData,
      },
      pinnedLinksCache: {
        ...state.pinnedLinksCache,
        [activeProfileId]: updatedPinnedLinks,
      },
    }));

    // Pin the browser tab
    chrome.tabs.query({}).then((tabs) => {
      const tab = tabs.find((t) => t.url === linkToMove.url);
      if (tab?.id) {
        chrome.tabs.update(tab.id, { pinned: true }).catch(() => {});
      }
    }).catch(() => {});

    // Save workspace change
    savePortable({
      profiles,
      workspaces,
      workspaceDataCache: {
        ...workspaceDataCache,
        [activeWorkspaceId]: updatedWorkspaceData,
      },
      pinnedLinksCache: {
        ...pinnedLinksCache,
        [activeProfileId]: updatedPinnedLinks,
      },
    });

    // Save to profile settings (background)
    if (pat && gistId) {
      saveProfileSettings(gistId, profile.name, { pinnedLinks: updatedPinnedLinks }, pat).catch(
        () => {}
      );
    }

    // Queue workspace sync
    get().saveWorkspace();
  },

  movePinnedToWorkspace: (linkId: string) => {
    const {
      activeProfileId,
      activeWorkspaceId,
      workspaceDataCache,
      pinnedLinksCache,
      profiles,
      workspaces,
      pat,
      gistId,
    } = get();
    if (!activeProfileId || !activeWorkspaceId) return;
    if (!workspaceDataCache[activeWorkspaceId]) return;

    const profile = profiles.find((p) => p.id === activeProfileId);
    if (!profile) return;

    const currentPinnedLinks = pinnedLinksCache[activeProfileId] || [];
    const pinnedLinkToMove = currentPinnedLinks.find((link) => link.id === linkId);
    if (!pinnedLinkToMove) return;

    // Create workspace link from pinned link
    const workspaceLink: LinkItem = {
      id: nanoid(),
      url: pinnedLinkToMove.url,
      title: pinnedLinkToMove.title,
      favicon: pinnedLinkToMove.favicon,
      pinned: false,
    };

    // Remove from pinned links
    const updatedPinnedLinks = currentPinnedLinks.filter((link) => link.id !== linkId);

    // Add to workspace
    const currentData = workspaceDataCache[activeWorkspaceId];
    const updatedWorkspaceData = {
      ...currentData,
      links: [...currentData.links, workspaceLink],
      updatedAt: Date.now(),
    };

    set((state) => ({
      workspaceDataCache: {
        ...state.workspaceDataCache,
        [activeWorkspaceId]: updatedWorkspaceData,
      },
      pinnedLinksCache: {
        ...state.pinnedLinksCache,
        [activeProfileId]: updatedPinnedLinks,
      },
    }));

    // Unpin the browser tab
    chrome.tabs.query({}).then((tabs) => {
      const tab = tabs.find((t) => t.url === pinnedLinkToMove.url);
      if (tab?.id) {
        chrome.tabs.update(tab.id, { pinned: false }).catch(() => {});
      }
    }).catch(() => {});

    // Save changes
    savePortable({
      profiles,
      workspaces,
      workspaceDataCache: {
        ...workspaceDataCache,
        [activeWorkspaceId]: updatedWorkspaceData,
      },
      pinnedLinksCache: {
        ...pinnedLinksCache,
        [activeProfileId]: updatedPinnedLinks,
      },
    });

    // Save to profile settings (background)
    if (pat && gistId) {
      saveProfileSettings(gistId, profile.name, { pinnedLinks: updatedPinnedLinks }, pat).catch(
        () => {}
      );
    }

    // Queue workspace sync
    get().saveWorkspace();
  },

  // ============================================================================
  // SAVE (debounced, non-blocking)
  // ============================================================================

  saveWorkspace: () => {
    if (!debouncedSave) {
      debouncedSave = debounce(async () => {
        const state = get();
        const {
          activeWorkspaceId,
          workspaceDataCache,
          workspaces,
          pat,
          gistId,
        } = state;

        if (!activeWorkspaceId || !workspaceDataCache[activeWorkspaceId])
          return;

        const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
        if (!workspace) return;

        const workspaceData = workspaceDataCache[activeWorkspaceId];

        set({ isSaving: true });

        // Save to portable cache first (instant, offline)
        await savePortable({
          profiles: state.profiles,
          workspaces: state.workspaces,
          workspaceDataCache: state.workspaceDataCache,
        });

        // Sync to Gist if online (non-blocking)
        if (pat && gistId) {
          try {
            await updateGistFile(
              gistId,
              workspace.filename,
              serializeWorkspaceData(workspaceData),
              pat
            );
          } catch {
            set({ syncError: 'Failed to save to cloud' });
          }
        }

        set({ isSaving: false });
      }, 3000);
    }

    debouncedSave();
  },

  // ============================================================================
  // UI PREFERENCES
  // ============================================================================

  setAccentColor: (accentColor: AccentColor) => {
    const { pat, gistId, activeProfileId, profiles } = get();
    const activeProfile = profiles.find((p) => p.id === activeProfileId);

    // Optimistic update
    set((state) => ({
      accentColor,
      profiles: state.profiles.map((p) =>
        p.id === activeProfileId ? { ...p, accentColor } : p
      ),
    }));

    // Update portable cache
    const { profiles: updatedProfiles, workspaces, workspaceDataCache } = get();
    savePortable({ profiles: updatedProfiles, workspaces, workspaceDataCache });

    // Sync to Gist (non-blocking)
    if (pat && gistId && activeProfile) {
      // Preserve workspace order when saving accent color
      const profileWorkspaces = workspaces.filter(
        (w) => w.profile === activeProfile.name
      );
      const workspaceOrder = profileWorkspaces.map((w) => w.id);

      saveProfileSettings(
        gistId,
        activeProfile.name,
        {
          name: activeProfile.name,
          accentColor,
          createdAt: activeProfile.createdAt,
          workspaceOrder,
        },
        pat
      ).catch(() => {
        // Silently ignore - preference sync is not critical
      });
    }
  },

  setColorMode: (colorMode: ColorMode) => {
    set({ colorMode });
    saveSession({ colorMode });
  },

  setMemorySaverMode: (memorySaverMode: boolean) => {
    set({ memorySaverMode });
    saveSession({ memorySaverMode });
  },

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  clearSyncError: () => set({ syncError: null }),
}));

// ============================================================================
// SELECTORS (for derived state)
// ============================================================================

/**
 * Selector for active workspace data
 * Use this instead of accessing workspaceDataCache directly
 */
export const selectActiveWorkspaceData = (state: AppStore) => {
  if (!state.activeWorkspaceId) return null;
  return state.workspaceDataCache[state.activeWorkspaceId] || null;
};
