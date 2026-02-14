import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { AppStore } from './types'
import type { LinkItem, Profile, WorkspaceData, WorkspaceMeta } from '../github/types'
import { debounce } from '@/shared/utils/debounce'
import { generateWorkspaceFilename, parseWorkspaceFilename } from '@/shared/utils/urlParser'
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

  // Data state
  profiles: [],
  workspaces: [],
  activeWorkspaceData: null,

  // Initialize the store
  init: async () => {
    set({ isLoading: true, error: null })

    try {
      // Load credentials from chrome.storage.local
      const result = await chrome.storage.local.get(['pat', 'gistId']) as { pat?: string; gistId?: string }
      const { pat, gistId } = result

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
      const workspacesList: WorkspaceMeta[] = []

      for (const [filename, _file] of Object.entries(gist.files)) {
        // Skip non-workspace files (like README.md)
        if (!filename.endsWith('.json')) continue

        const parsed = parseWorkspaceFilename(filename)
        if (!parsed) continue

        profileSet.add(parsed.profile)
        workspacesList.push({
          id: nanoid(),
          name: parsed.workspace,
          profile: parsed.profile,
          filename,
        })
      }

      // Create profile objects
      const profiles: Profile[] = Array.from(profileSet).map((name, index) => ({
        id: `profile-${index}`,
        name,
        createdAt: Date.now(),
      }))

      // If no profiles exist, create a default one
      if (profiles.length === 0) {
        profiles.push({
          id: 'profile-default',
          name: 'Personal',
          createdAt: Date.now(),
        })
      }

      // Set initial active profile and workspace
      const activeProfile = profiles[0]
      const activeWorkspace = workspacesList.find(w => w.profile === activeProfile.name)

      set({
        pat,
        gistId,
        isAuthenticated: true,
        profiles,
        workspaces: workspacesList,
        activeProfileId: activeProfile.id,
        activeWorkspaceId: activeWorkspace?.id || null,
        isLoading: false,
      })

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

      // Create default profile
      const defaultProfile: Profile = {
        id: nanoid(),
        name: 'Personal',
        createdAt: Date.now(),
      }

      set({
        pat,
        gistId,
        isAuthenticated: true,
        profiles: [defaultProfile],
        workspaces: [],
        activeProfileId: defaultProfile.id,
        activeWorkspaceId: null,
        activeWorkspaceData: null,
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
  switchProfile: (profileId: string) => {
    const { workspaces, profiles } = get()
    const profile = profiles.find(p => p.id === profileId)
    
    if (!profile) return

    // Find first workspace in this profile
    const firstWorkspace = workspaces.find(w => w.profile === profile.name)

    set({
      activeProfileId: profileId,
      activeWorkspaceId: firstWorkspace?.id || null,
      activeWorkspaceData: firstWorkspace ? workspaceDataCache[firstWorkspace.id] || null : null,
    })

    // Load workspace data if not cached
    if (firstWorkspace && !workspaceDataCache[firstWorkspace.id]) {
      get().switchWorkspace(firstWorkspace.id)
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
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load workspace',
        isLoading: false,
      })
    }
  },

  // Create profile
  createProfile: (name: string) => {
    const newProfile: Profile = {
      id: nanoid(),
      name,
      createdAt: Date.now(),
    }

    set(state => ({
      profiles: [...state.profiles, newProfile],
      activeProfileId: newProfile.id,
      activeWorkspaceId: null,
      activeWorkspaceData: null,
    }))
  },

  // Delete profile
  deleteProfile: async (profileId: string) => {
    const { profiles, workspaces, activeProfileId, pat, gistId } = get()
    const profile = profiles.find(p => p.id === profileId)
    
    if (!profile) return

    // Get workspaces to delete
    const workspacesToDelete = workspaces.filter(w => w.profile === profile.name)
    
    // Delete workspace files from Gist
    if (pat && gistId) {
      for (const workspace of workspacesToDelete) {
        try {
          await deleteGistFile(gistId, workspace.filename, pat)
          delete workspaceDataCache[workspace.id]
        } catch {
          // Continue even if individual delete fails
        }
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
    const workspaceId = nanoid()

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
}))
