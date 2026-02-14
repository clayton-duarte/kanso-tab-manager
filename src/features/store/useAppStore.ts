import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { AppStore, AccentColor } from './types'
import type { LinkItem, Profile, WorkspaceData, WorkspaceMeta, ProfileSettings } from '../github/types'
import { DEFAULT_PROFILE_SETTINGS } from '../github/types'
import { debounce } from '@/shared/utils/debounce'
import { generateWorkspaceFilename, parseWorkspaceFilename, parseProfileSettingsFilename, generateProfileSettingsFilename } from '@/shared/utils/urlParser'
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
} from '../github/api'

// Cache for workspace data (to avoid refetching)
const workspaceDataCache: Record<string, WorkspaceData> = {}

// Debounced save function (will be initialized in the store)
let debouncedSave: ReturnType<typeof debounce> | null = null

export const useAppStore = create<AppStore>((set, get) => ({
  // Auth state
  pat: null,
  gistId: null,
  isAuthenticated: false,

  // UI state
  activeProfileId: null,
  activeWorkspaceId: null,
  isLoading: false,
  error: null,
  isSaving: false,
  accentColor: 'gray',

  // Data state
  profiles: [],
  workspaces: [],
  activeWorkspaceData: null,

  // Initialize the store
  init: async () => {
    set({ isLoading: true, error: null })

    try {
      // Load credentials and preferences from chrome.storage.local
      const result = await chrome.storage.local.get(['pat', 'gistId', 'accentColor', 'activeProfileId', 'activeWorkspaceId', 'profileWorkspaceMap']) as { 
        pat?: string; 
        gistId?: string; 
        accentColor?: AccentColor;
        activeProfileId?: string;
        activeWorkspaceId?: string;
        profileWorkspaceMap?: Record<string, string>;
      }
      const { pat, gistId, accentColor, activeProfileId: savedProfileId, activeWorkspaceId: savedWorkspaceId } = result
      
      // Set accent color if stored
      if (accentColor) {
        set({ accentColor })
      }

      if (!pat || !gistId) {
        set({
          isAuthenticated: false,
          isLoading: false,
        })
        return
      }

      // Validate credentials
      const isPatValid = await validatePat(pat)
      if (!isPatValid) {
        set({
          error: 'Invalid GitHub Personal Access Token',
          isAuthenticated: false,
          isLoading: false,
        })
        return
      }

      // Fetch the Gist
      const gist = await fetchGist(gistId, pat)

      // Parse filenames to extract profiles and workspaces
      const profileSet = new Set<string>()
      const profileSettingsMap = new Map<string, true>()  // Track which profiles have settings files
      const workspacesList: WorkspaceMeta[] = []

      for (const [filename, _file] of Object.entries(gist.files)) {
        // Skip non-JSON files (like README.md)
        if (!filename.endsWith('.json')) continue

        // Check if it's a profile settings file
        const profileFromSettings = parseProfileSettingsFilename(filename)
        if (profileFromSettings) {
          profileSet.add(profileFromSettings)
          profileSettingsMap.set(profileFromSettings, true)
          continue
        }

        // Check if it's a workspace file
        const parsed = parseWorkspaceFilename(filename)
        if (!parsed) continue

        profileSet.add(parsed.profile)
        workspacesList.push({
          id: `ws-${filename}`,  // Use deterministic ID based on filename
          name: parsed.workspace,
          profile: parsed.profile,
          filename,
        })
      }

      // Fetch profile settings for each profile to get accent colors
      const profileSettingsResults = await Promise.all(
        Array.from(profileSet).map(async (name) => {
          const settings = await fetchProfileSettings(gistId, name, pat)
          return { name, settings }
        })
      )
      const profileSettingsCache = new Map(
        profileSettingsResults.map(({ name, settings }) => [name, settings])
      )

      // Create profile objects with deterministic IDs and accent colors
      const profiles: Profile[] = Array.from(profileSet).map((name) => {
        const settings = profileSettingsCache.get(name)
        return {
          id: `profile-${name}`,  // Use deterministic ID based on profile name
          name,
          createdAt: settings?.createdAt || Date.now(),
          accentColor: settings?.accentColor || DEFAULT_PROFILE_SETTINGS.accentColor,
        }
      })

      // If no profiles exist, create a default one
      if (profiles.length === 0) {
        profiles.push({
          id: 'profile-default',
          name: 'Personal',
          createdAt: Date.now(),
          accentColor: DEFAULT_PROFILE_SETTINGS.accentColor,
        })
      }

      // Set initial active profile and workspace
      // Try to restore saved session, otherwise use defaults
      let activeProfile = profiles[0]
      let activeWorkspace = workspacesList.find(w => w.profile === activeProfile.name)

      // Restore saved profile if it exists
      if (savedProfileId) {
        const savedProfile = profiles.find(p => p.id === savedProfileId)
        if (savedProfile) {
          activeProfile = savedProfile
          // Try to restore saved workspace
          if (savedWorkspaceId) {
            const savedWorkspace = workspacesList.find(w => w.id === savedWorkspaceId && w.profile === savedProfile.name)
            if (savedWorkspace) {
              activeWorkspace = savedWorkspace
            } else {
              // Workspace not found, use first workspace in profile
              activeWorkspace = workspacesList.find(w => w.profile === savedProfile.name)
            }
          } else {
            activeWorkspace = workspacesList.find(w => w.profile === savedProfile.name)
          }
        }
      }

      // Set accent color from active profile
      const profileAccentColor = activeProfile.accentColor || DEFAULT_PROFILE_SETTINGS.accentColor
      
      set({
        pat,
        gistId,
        isAuthenticated: true,
        profiles,
        workspaces: workspacesList,
        activeProfileId: activeProfile.id,
        activeWorkspaceId: activeWorkspace?.id || null,
        accentColor: profileAccentColor,
        isLoading: false,
      })

      // Save accent color to chrome.storage.local for faster access on next load
      await chrome.storage.local.set({ accentColor: profileAccentColor })

      // Load the active workspace data if one exists
      if (activeWorkspace) {
        await get().switchWorkspace(activeWorkspace.id)
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false,
        isAuthenticated: false,
      })
    }
  },

  // Set credentials
  setCredentials: async (pat: string, gistId: string) => {
    set({ isLoading: true, error: null })

    try {
      // Validate PAT
      const isPatValid = await validatePat(pat)
      if (!isPatValid) {
        set({
          error: 'Invalid GitHub Personal Access Token',
          isLoading: false,
        })
        return
      }

      // Validate Gist exists
      const isGistValid = await validateGist(gistId, pat)
      if (!isGistValid) {
        set({
          error: 'Gist not found or inaccessible',
          isLoading: false,
        })
        return
      }

      // Store in chrome.storage.local
      await chrome.storage.local.set({ pat, gistId })

      set({
        pat,
        gistId,
        isAuthenticated: true,
        isLoading: false,
      })

      // Re-initialize to fetch data
      await get().init()
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save credentials',
        isLoading: false,
      })
    }
  },

  // Clear credentials
  clearCredentials: () => {
    chrome.storage.local.remove(['pat', 'gistId'])
    
    // Clear cache
    Object.keys(workspaceDataCache).forEach(key => delete workspaceDataCache[key])
    
    set({
      pat: null,
      gistId: null,
      isAuthenticated: false,
      profiles: [],
      workspaces: [],
      activeWorkspaceData: null,
      activeProfileId: null,
      activeWorkspaceId: null,
    })
  },

  // Setup with new Gist (creates a new Gist automatically)
  setupWithNewGist: async (pat: string) => {
    set({ isLoading: true, error: null })

    try {
      // Validate PAT
      const isPatValid = await validatePat(pat)
      if (!isPatValid) {
        set({
          error: 'Invalid GitHub Personal Access Token',
          isLoading: false,
        })
        return
      }

      // Create a new Gist
      const gistId = await createNewGist(pat)

      // Store in chrome.storage.local
      await chrome.storage.local.set({ pat, gistId })

      // Create default profile with default accent color
      const defaultAccentColor = DEFAULT_PROFILE_SETTINGS.accentColor
      const defaultProfile: Profile = {
        id: 'profile-Personal',  // Deterministic ID
        name: 'Personal',
        createdAt: Date.now(),
        accentColor: defaultAccentColor,
      }

      // Create default workspace for the profile
      const defaultWorkspaceFilename = generateWorkspaceFilename(defaultProfile.name, 'Default')
      const defaultWorkspaceId = `ws-${defaultWorkspaceFilename}`  // Deterministic ID
      const defaultWorkspace: WorkspaceMeta = {
        id: defaultWorkspaceId,
        name: 'Default',
        profile: defaultProfile.name,
        filename: defaultWorkspaceFilename,
      }
      const defaultWorkspaceData: WorkspaceData = {
        id: defaultWorkspaceId,
        name: 'Default',
        profile: defaultProfile.name,
        createdAt: Date.now(),
        links: [],
      }

      // Cache the workspace data
      workspaceDataCache[defaultWorkspaceId] = defaultWorkspaceData

      // Save workspace and profile settings to Gist
      try {
        await updateGistFile(gistId, defaultWorkspaceFilename, serializeWorkspaceData(defaultWorkspaceData), pat)
        
        // Save profile settings
        const profileSettings: ProfileSettings = {
          name: defaultProfile.name,
          accentColor: defaultAccentColor,
          createdAt: defaultProfile.createdAt,
        }
        await saveProfileSettings(gistId, defaultProfile.name, profileSettings, pat)
      } catch (error) {
        console.error('Failed to create default files in Gist:', error)
      }

      // Save session state to storage for persistence (including profile workspace map)
      await chrome.storage.local.set({ 
        activeProfileId: defaultProfile.id,
        activeWorkspaceId: defaultWorkspaceId,
        accentColor: defaultAccentColor,
        profileWorkspaceMap: { [defaultProfile.id]: defaultWorkspaceId }
      })

      set({
        pat,
        gistId,
        isAuthenticated: true,
        profiles: [defaultProfile],
        workspaces: [defaultWorkspace],
        activeProfileId: defaultProfile.id,
        activeWorkspaceId: defaultWorkspaceId,
        activeWorkspaceData: defaultWorkspaceData,
        accentColor: defaultAccentColor,
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create Gist',
        isLoading: false,
      })
    }
  },

  // Delete Gist and logout
  deleteGistAndLogout: async () => {
    const { pat, gistId } = get()
    
    if (pat && gistId) {
      try {
        // Delete the entire Gist
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'DELETE',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${pat}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        })
        
        if (!response.ok && response.status !== 404) {
          throw new Error('Failed to delete Gist')
        }
      } catch (error) {
        console.error('Failed to delete Gist:', error)
        // Continue with logout even if delete fails
      }
    }

    get().clearCredentials()
  },

  // Switch profile
  switchProfile: async (profileId: string) => {
    const { workspaces, profiles } = get()
    const profile = profiles.find(p => p.id === profileId)
    
    if (!profile) return

    // Load the profile workspace map to find last active workspace for this profile
    const result = await chrome.storage.local.get(['profileWorkspaceMap']) as { profileWorkspaceMap?: Record<string, string> }
    const profileWorkspaceMap = result.profileWorkspaceMap || {}
    
    // Try to find the last workspace used in this profile
    const lastWorkspaceId = profileWorkspaceMap[profileId]
    let targetWorkspace = lastWorkspaceId 
      ? workspaces.find(w => w.id === lastWorkspaceId && w.profile === profile.name)
      : null
    
    // Fall back to first workspace if last one not found
    if (!targetWorkspace) {
      targetWorkspace = workspaces.find(w => w.profile === profile.name)
    }

    // Apply profile's accent color
    const profileAccentColor = profile.accentColor || DEFAULT_PROFILE_SETTINGS.accentColor

    set({
      activeProfileId: profileId,
      activeWorkspaceId: targetWorkspace?.id || null,
      activeWorkspaceData: targetWorkspace ? workspaceDataCache[targetWorkspace.id] || null : null,
      accentColor: profileAccentColor,
    })

    // Save to session storage for persistence
    chrome.storage.local.set({ 
      activeProfileId: profileId,
      activeWorkspaceId: targetWorkspace?.id || null,
      accentColor: profileAccentColor,
    })

    // Load workspace data if not cached
    if (targetWorkspace && !workspaceDataCache[targetWorkspace.id]) {
      get().switchWorkspace(targetWorkspace.id)
    }
  },

  // Switch workspace
  switchWorkspace: async (workspaceId: string) => {
    const { workspaces, pat, gistId } = get()
    const workspace = workspaces.find(w => w.id === workspaceId)
    
    if (!workspace) return

    // Check cache first
    if (workspaceDataCache[workspaceId]) {
      set({
        activeWorkspaceId: workspaceId,
        activeWorkspaceData: workspaceDataCache[workspaceId],
      })
      // Save to session storage for persistence and update profile workspace map
      const { activeProfileId } = get()
      const result = await chrome.storage.local.get(['profileWorkspaceMap']) as { profileWorkspaceMap?: Record<string, string> }
      const profileWorkspaceMap = result.profileWorkspaceMap || {}
      if (activeProfileId) {
        profileWorkspaceMap[activeProfileId] = workspaceId
      }
      chrome.storage.local.set({ activeWorkspaceId: workspaceId, profileWorkspaceMap })
      return
    }

    set({ isLoading: true, error: null })

    try {
      if (!pat || !gistId) {
        throw new Error('Not authenticated')
      }

      // Fetch the Gist to get the file content
      const gist = await fetchGist(gistId, pat)
      const file = gist.files[workspace.filename]

      if (!file) {
        // Workspace file doesn't exist yet - create empty workspace data
        const newWorkspaceData: WorkspaceData = {
          id: workspaceId,
          name: workspace.name,
          profile: workspace.profile,
          createdAt: Date.now(),
          links: [],
        }
        
        workspaceDataCache[workspaceId] = newWorkspaceData
        
        set({
          activeWorkspaceId: workspaceId,
          activeWorkspaceData: newWorkspaceData,
          isLoading: false,
        })
        return
      }

      // Fetch file content if truncated or not included
      let content = file.content
      if (!content || file.truncated) {
        content = await fetchGistFileContent(file.raw_url, pat)
      }

      // Parse workspace data
      const workspaceData = parseWorkspaceData(content)
      
      if (!workspaceData) {
        throw new Error('Invalid workspace data format')
      }

      // Update the workspace ID to match our internal ID
      workspaceData.id = workspaceId

      // Cache the data
      workspaceDataCache[workspaceId] = workspaceData

      set({
        activeWorkspaceId: workspaceId,
        activeWorkspaceData: workspaceData,
        isLoading: false,
      })

      // Save to session storage for persistence and update profile workspace map
      const { activeProfileId } = get()
      const mapResult = await chrome.storage.local.get(['profileWorkspaceMap']) as { profileWorkspaceMap?: Record<string, string> }
      const profileWorkspaceMap = mapResult.profileWorkspaceMap || {}
      if (activeProfileId) {
        profileWorkspaceMap[activeProfileId] = workspaceId
      }
      chrome.storage.local.set({ activeWorkspaceId: workspaceId, profileWorkspaceMap })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load workspace',
        isLoading: false,
      })
    }
  },

  // Create profile
  createProfile: async (name: string) => {
    const { pat, gistId, accentColor } = get()
    
    // Use current accent color for new profile (inherit from current)
    const newAccentColor = accentColor || DEFAULT_PROFILE_SETTINGS.accentColor
    
    const newProfile: Profile = {
      id: `profile-${name}`,  // Deterministic ID
      name,
      createdAt: Date.now(),
      accentColor: newAccentColor,
    }

    // Create default workspace for the new profile
    const defaultWorkspaceFilename = generateWorkspaceFilename(name, 'Default')
    const defaultWorkspaceId = `ws-${defaultWorkspaceFilename}`  // Deterministic ID
    const defaultWorkspace: WorkspaceMeta = {
      id: defaultWorkspaceId,
      name: 'Default',
      profile: name,
      filename: defaultWorkspaceFilename,
    }
    const defaultWorkspaceData: WorkspaceData = {
      id: defaultWorkspaceId,
      name: 'Default',
      profile: name,
      createdAt: Date.now(),
      links: [],
    }

    // Cache the workspace data
    workspaceDataCache[defaultWorkspaceId] = defaultWorkspaceData

    set(state => ({
      profiles: [...state.profiles, newProfile],
      workspaces: [...state.workspaces, defaultWorkspace],
      activeProfileId: newProfile.id,
      activeWorkspaceId: defaultWorkspaceId,
      activeWorkspaceData: defaultWorkspaceData,
      accentColor: newAccentColor,
    }))

    // Save to session storage for persistence and update profile workspace map
    const result = await chrome.storage.local.get(['profileWorkspaceMap']) as { profileWorkspaceMap?: Record<string, string> }
    const profileWorkspaceMap = result.profileWorkspaceMap || {}
    profileWorkspaceMap[newProfile.id] = defaultWorkspaceId
    chrome.storage.local.set({ 
      activeProfileId: newProfile.id,
      activeWorkspaceId: defaultWorkspaceId,
      accentColor: newAccentColor,
      profileWorkspaceMap
    })

    // Save workspace and profile settings to Gist
    if (pat && gistId) {
      try {
        // Save default workspace
        await updateGistFile(gistId, defaultWorkspaceFilename, serializeWorkspaceData(defaultWorkspaceData), pat)
        
        // Save profile settings
        const profileSettings: ProfileSettings = {
          name,
          accentColor: newAccentColor,
          createdAt: newProfile.createdAt,
        }
        await saveProfileSettings(gistId, name, profileSettings, pat)
      } catch (error) {
        console.error('Failed to create profile files in Gist:', error)
      }
    }
  },

  // Delete profile
  deleteProfile: async (profileId: string) => {
    const { profiles, workspaces, activeProfileId, pat, gistId } = get()
    const profile = profiles.find(p => p.id === profileId)
    
    if (!profile) return

    // Get workspaces to delete
    const workspacesToDelete = workspaces.filter(w => w.profile === profile.name)
    
    // Delete workspace files and profile settings from Gist
    if (pat && gistId) {
      // Delete workspace files
      for (const workspace of workspacesToDelete) {
        try {
          await deleteGistFile(gistId, workspace.filename, pat)
          delete workspaceDataCache[workspace.id]
        } catch {
          // Continue even if individual delete fails
        }
      }
      
      // Delete profile settings file
      try {
        const profileSettingsFilename = generateProfileSettingsFilename(profile.name)
        await deleteGistFile(gistId, profileSettingsFilename, pat)
      } catch {
        // Continue even if delete fails
      }
    }

    // Filter out workspaces belonging to this profile
    const remainingWorkspaces = workspaces.filter(w => w.profile !== profile.name)

    // Select a different profile if deleting the active one
    const newActiveProfileId = activeProfileId === profileId
      ? profiles.find(p => p.id !== profileId)?.id || null
      : activeProfileId

    set({
      profiles: profiles.filter(p => p.id !== profileId),
      workspaces: remainingWorkspaces,
      activeProfileId: newActiveProfileId,
    })

    // Switch to new active profile's workspace
    if (newActiveProfileId && newActiveProfileId !== activeProfileId) {
      get().switchProfile(newActiveProfileId)
    }
  },

  // Create workspace
  createWorkspace: async (name: string) => {
    const { profiles, activeProfileId, pat, gistId } = get()
    const profile = profiles.find(p => p.id === activeProfileId)
    
    if (!profile) return

    const filename = generateWorkspaceFilename(profile.name, name)
    const workspaceId = `ws-${filename}`  // Deterministic ID

    const newWorkspace: WorkspaceMeta = {
      id: workspaceId,
      name,
      profile: profile.name,
      filename,
    }

    const newWorkspaceData: WorkspaceData = {
      id: workspaceId,
      name,
      profile: profile.name,
      createdAt: Date.now(),
      links: [],
    }

    // Cache the data
    workspaceDataCache[workspaceId] = newWorkspaceData

    set(state => ({
      workspaces: [...state.workspaces, newWorkspace],
      activeWorkspaceId: workspaceId,
      activeWorkspaceData: newWorkspaceData,
    }))

    // Save to session storage for persistence and update profile workspace map
    const mapResult = await chrome.storage.local.get(['profileWorkspaceMap']) as { profileWorkspaceMap?: Record<string, string> }
    const profileWorkspaceMap = mapResult.profileWorkspaceMap || {}
    if (activeProfileId) {
      profileWorkspaceMap[activeProfileId] = workspaceId
    }
    chrome.storage.local.set({ activeWorkspaceId: workspaceId, profileWorkspaceMap })

    // Create file in Gist
    if (pat && gistId) {
      try {
        await updateGistFile(gistId, filename, serializeWorkspaceData(newWorkspaceData), pat)
      } catch (error) {
        console.error('Failed to create workspace in Gist:', error)
        // Don't fail the UI - workspace is created locally
      }
    }
  },

  // Delete workspace
  deleteWorkspace: async (workspaceId: string) => {
    const { workspaces, activeWorkspaceId, activeProfileId, profiles, pat, gistId } = get()
    const workspace = workspaces.find(w => w.id === workspaceId)
    
    if (!workspace) return

    // Delete from Gist
    if (pat && gistId) {
      try {
        await deleteGistFile(gistId, workspace.filename, pat)
      } catch (error) {
        console.error('Failed to delete workspace from Gist:', error)
      }
    }

    // Remove from cache
    delete workspaceDataCache[workspaceId]

    // Select a different workspace if deleting the active one
    const profile = profiles.find(p => p.id === activeProfileId)
    const remainingWorkspaces = workspaces.filter(w => w.id !== workspaceId)
    const newActiveWorkspace = activeWorkspaceId === workspaceId
      ? remainingWorkspaces.find(w => w.profile === profile?.name)
      : workspaces.find(w => w.id === activeWorkspaceId)

    set({
      workspaces: remainingWorkspaces,
      activeWorkspaceId: newActiveWorkspace?.id || null,
      activeWorkspaceData: newActiveWorkspace
        ? workspaceDataCache[newActiveWorkspace.id] || null
        : null,
    })

    // Load new active workspace if needed
    if (newActiveWorkspace && !workspaceDataCache[newActiveWorkspace.id]) {
      await get().switchWorkspace(newActiveWorkspace.id)
    }
  },

  // Rename workspace
  renameWorkspace: async (workspaceId: string, newName: string) => {
    set(state => ({
      workspaces: state.workspaces.map(w =>
        w.id === workspaceId ? { ...w, name: newName } : w
      ),
      activeWorkspaceData: state.activeWorkspaceData?.id === workspaceId
        ? { ...state.activeWorkspaceData, name: newName }
        : state.activeWorkspaceData,
    }))

    // Update cache
    if (workspaceDataCache[workspaceId]) {
      workspaceDataCache[workspaceId] = {
        ...workspaceDataCache[workspaceId],
        name: newName,
      }
    }

    // Queue save
    get().saveWorkspace()
  },

  // Add link
  addLink: (url: string, title: string, favicon?: string) => {
    const newLink: LinkItem = {
      id: nanoid(),
      url,
      title,
      favicon,
      pinned: false,
    }

    set(state => {
      if (!state.activeWorkspaceData) return state

      const updated = {
        ...state.activeWorkspaceData,
        links: [...state.activeWorkspaceData.links, newLink],
      }

      // Update cache
      workspaceDataCache[state.activeWorkspaceData.id] = updated

      return {
        activeWorkspaceData: updated,
      }
    })

    // Queue save
    get().saveWorkspace()
  },

  // Remove link
  removeLink: (linkId: string) => {
    set(state => {
      if (!state.activeWorkspaceData) return state

      const updated = {
        ...state.activeWorkspaceData,
        links: state.activeWorkspaceData.links.filter(l => l.id !== linkId),
      }

      // Update cache
      workspaceDataCache[state.activeWorkspaceData.id] = updated

      return {
        activeWorkspaceData: updated,
      }
    })

    // Queue save
    get().saveWorkspace()
  },

  // Update link
  updateLink: (linkId: string, updates: Partial<LinkItem>) => {
    set(state => {
      if (!state.activeWorkspaceData) return state

      const updated = {
        ...state.activeWorkspaceData,
        links: state.activeWorkspaceData.links.map(l =>
          l.id === linkId ? { ...l, ...updates } : l
        ),
      }

      // Update cache
      workspaceDataCache[state.activeWorkspaceData.id] = updated

      return {
        activeWorkspaceData: updated,
      }
    })

    // Queue save
    get().saveWorkspace()
  },

  // Toggle pin
  togglePinLink: (linkId: string) => {
    set(state => {
      if (!state.activeWorkspaceData) return state

      const updated = {
        ...state.activeWorkspaceData,
        links: state.activeWorkspaceData.links.map(l =>
          l.id === linkId ? { ...l, pinned: !l.pinned } : l
        ),
      }

      // Update cache
      workspaceDataCache[state.activeWorkspaceData.id] = updated

      return {
        activeWorkspaceData: updated,
      }
    })

    // Queue save
    get().saveWorkspace()
  },

  // Reorder links
  reorderLinks: (oldIndex: number, newIndex: number) => {
    set(state => {
      if (!state.activeWorkspaceData) return state

      const links = [...state.activeWorkspaceData.links]
      const [removed] = links.splice(oldIndex, 1)
      links.splice(newIndex, 0, removed)

      const updated = {
        ...state.activeWorkspaceData,
        links,
      }

      // Update cache
      workspaceDataCache[state.activeWorkspaceData.id] = updated

      return {
        activeWorkspaceData: updated,
      }
    })

    // Queue save
    get().saveWorkspace()
  },

  // Save workspace (debounced)
  saveWorkspace: async () => {
    // Initialize debounced save if not already done
    if (!debouncedSave) {
      debouncedSave = debounce(async () => {
        const state = get()
        if (!state.activeWorkspaceData || !state.pat || !state.gistId) return

        const workspace = state.workspaces.find(w => w.id === state.activeWorkspaceData?.id)
        if (!workspace) return

        set({ isSaving: true })

        try {
          await updateGistFile(
            state.gistId,
            workspace.filename,
            serializeWorkspaceData(state.activeWorkspaceData),
            state.pat
          )
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to save',
          })
        } finally {
          set({ isSaving: false })
        }
      }, 3000) // 3 second debounce
    }

    debouncedSave()
  },

  // Set error
  setError: (error: string | null) => set({ error }),

  // Clear error
  clearError: () => set({ error: null }),

  // Set accent color
  setAccentColor: async (accentColor: AccentColor) => {
    const { pat, gistId, activeProfileId, profiles } = get()
    const activeProfile = profiles.find(p => p.id === activeProfileId)
    
    // Update accent color in state
    set({ accentColor })
    
    // Update the profile's accent color in the profiles array
    if (activeProfile) {
      set(state => ({
        profiles: state.profiles.map(p => 
          p.id === activeProfileId 
            ? { ...p, accentColor } 
            : p
        )
      }))
    }
    
    // Save to chrome.storage.local for faster access
    await chrome.storage.local.set({ accentColor })
    
    // Save to profile settings file in Gist for cross-device sync
    if (pat && gistId && activeProfile) {
      try {
        const profileSettings: ProfileSettings = {
          name: activeProfile.name,
          accentColor,
          createdAt: activeProfile.createdAt,
        }
        await saveProfileSettings(gistId, activeProfile.name, profileSettings, pat)
      } catch {
        // Ignore save errors for preferences
      }
    }
  },
}))
