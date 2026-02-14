import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { AppStore } from './types'
import type { LinkItem, Profile, WorkspaceData, WorkspaceMeta } from '../github/types'
import { debounce } from '@/shared/utils/debounce'
import { generateWorkspaceFilename } from '@/shared/utils/urlParser'

// Mock data for development
const MOCK_PROFILES: Profile[] = [
  { id: 'profile-1', name: 'Personal', createdAt: Date.now() - 86400000 },
  { id: 'profile-2', name: 'Work', createdAt: Date.now() - 172800000 },
]

const MOCK_WORKSPACES: WorkspaceMeta[] = [
  { id: 'ws-1', name: 'Vacation Planning', profile: 'Personal', filename: 'Personal__Vacation_Planning.json' },
  { id: 'ws-2', name: 'Side Projects', profile: 'Personal', filename: 'Personal__Side_Projects.json' },
  { id: 'ws-3', name: 'Jira Tickets', profile: 'Work', filename: 'Work__Jira_Tickets.json' },
  { id: 'ws-4', name: 'Documentation', profile: 'Work', filename: 'Work__Documentation.json' },
]

const MOCK_WORKSPACE_DATA: Record<string, WorkspaceData> = {
  'ws-1': {
    id: 'ws-1',
    name: 'Vacation Planning',
    profile: 'Personal',
    createdAt: Date.now() - 86400000,
    links: [
      { id: 'link-1', url: 'https://www.airbnb.com', title: 'Airbnb', favicon: 'https://www.google.com/s2/favicons?domain=airbnb.com&sz=32', pinned: true },
      { id: 'link-2', url: 'https://www.kayak.com', title: 'Kayak Flights', favicon: 'https://www.google.com/s2/favicons?domain=kayak.com&sz=32', pinned: false },
      { id: 'link-3', url: 'https://www.tripadvisor.com', title: 'TripAdvisor', favicon: 'https://www.google.com/s2/favicons?domain=tripadvisor.com&sz=32', pinned: false },
    ],
  },
  'ws-2': {
    id: 'ws-2',
    name: 'Side Projects',
    profile: 'Personal',
    createdAt: Date.now() - 172800000,
    links: [
      { id: 'link-4', url: 'https://github.com', title: 'GitHub', favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=32', pinned: true },
      { id: 'link-5', url: 'https://vercel.com', title: 'Vercel', favicon: 'https://www.google.com/s2/favicons?domain=vercel.com&sz=32', pinned: false },
    ],
  },
  'ws-3': {
    id: 'ws-3',
    name: 'Jira Tickets',
    profile: 'Work',
    createdAt: Date.now() - 259200000,
    links: [
      { id: 'link-6', url: 'https://jira.atlassian.com', title: 'Jira', favicon: 'https://www.google.com/s2/favicons?domain=atlassian.com&sz=32', pinned: true },
      { id: 'link-7', url: 'https://confluence.atlassian.com', title: 'Confluence', favicon: 'https://www.google.com/s2/favicons?domain=atlassian.com&sz=32', pinned: false },
    ],
  },
  'ws-4': {
    id: 'ws-4',
    name: 'Documentation',
    profile: 'Work',
    createdAt: Date.now() - 345600000,
    links: [
      { id: 'link-8', url: 'https://react.dev', title: 'React Docs', favicon: 'https://www.google.com/s2/favicons?domain=react.dev&sz=32', pinned: true },
      { id: 'link-9', url: 'https://www.typescriptlang.org/docs', title: 'TypeScript Docs', favicon: 'https://www.google.com/s2/favicons?domain=typescriptlang.org&sz=32', pinned: false },
      { id: 'link-10', url: 'https://chakra-ui.com', title: 'Chakra UI', favicon: 'https://www.google.com/s2/favicons?domain=chakra-ui.com&sz=32', pinned: false },
    ],
  },
}

// Whether to use mock data (set to false when Gist integration is ready)
const USE_MOCK_DATA = true

// Debounced save function (will be initialized in the store)
let debouncedSave: ReturnType<typeof debounce> | null = null

export const useAppStore = create<AppStore>((set, get) => ({
  // Auth state
  pat: null,
  gistId: null,
  isAuthenticated: USE_MOCK_DATA, // Auto-authenticated in mock mode

  // UI state
  activeProfileId: USE_MOCK_DATA ? 'profile-1' : null,
  activeWorkspaceId: USE_MOCK_DATA ? 'ws-1' : null,
  isLoading: false,
  error: null,
  isSaving: false,

  // Data state
  profiles: USE_MOCK_DATA ? MOCK_PROFILES : [],
  workspaces: USE_MOCK_DATA ? MOCK_WORKSPACES : [],
  activeWorkspaceData: USE_MOCK_DATA ? MOCK_WORKSPACE_DATA['ws-1'] : null,

  // Initialize the store
  init: async () => {
    set({ isLoading: true, error: null })

    try {
      if (USE_MOCK_DATA) {
        // Using mock data - already initialized
        set({ isLoading: false })
        return
      }

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

      set({ pat, gistId, isAuthenticated: true })

      // TODO: Fetch gist and parse workspace data
      // This will be implemented in Phase 3

      set({ isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false,
      })
    }
  },

  // Set credentials
  setCredentials: async (pat: string, gistId: string) => {
    set({ isLoading: true, error: null })

    try {
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

  // Switch profile
  switchProfile: (profileId: string) => {
    const { workspaces } = get()
    const profile = get().profiles.find(p => p.id === profileId)
    
    if (!profile) return

    // Find first workspace in this profile
    const firstWorkspace = workspaces.find(w => w.profile === profile.name)

    set({
      activeProfileId: profileId,
      activeWorkspaceId: firstWorkspace?.id || null,
      activeWorkspaceData: firstWorkspace && USE_MOCK_DATA
        ? MOCK_WORKSPACE_DATA[firstWorkspace.id] || null
        : null,
    })
  },

  // Switch workspace
  switchWorkspace: async (workspaceId: string) => {
    set({ isLoading: true, error: null })

    try {
      if (USE_MOCK_DATA) {
        const workspaceData = MOCK_WORKSPACE_DATA[workspaceId]
        set({
          activeWorkspaceId: workspaceId,
          activeWorkspaceData: workspaceData || null,
          isLoading: false,
        })
        return
      }

      // TODO: Fetch workspace data from Gist
      // This will be implemented in Phase 3

      set({
        activeWorkspaceId: workspaceId,
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
    }))
  },

  // Delete profile
  deleteProfile: async (profileId: string) => {
    const { profiles, workspaces, activeProfileId } = get()
    const profile = profiles.find(p => p.id === profileId)
    
    if (!profile) return

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

    // TODO: Delete workspace files from Gist
  },

  // Create workspace
  createWorkspace: async (name: string) => {
    const { profiles, activeProfileId } = get()
    const profile = profiles.find(p => p.id === activeProfileId)
    
    if (!profile) return

    const newWorkspace: WorkspaceMeta = {
      id: nanoid(),
      name,
      profile: profile.name,
      filename: generateWorkspaceFilename(profile.name, name),
    }

    const newWorkspaceData: WorkspaceData = {
      id: newWorkspace.id,
      name,
      profile: profile.name,
      createdAt: Date.now(),
      links: [],
    }

    // Update mock data if in mock mode
    if (USE_MOCK_DATA) {
      MOCK_WORKSPACE_DATA[newWorkspace.id] = newWorkspaceData
    }

    set(state => ({
      workspaces: [...state.workspaces, newWorkspace],
      activeWorkspaceId: newWorkspace.id,
      activeWorkspaceData: newWorkspaceData,
    }))

    // TODO: Create file in Gist
  },

  // Delete workspace
  deleteWorkspace: async (workspaceId: string) => {
    const { workspaces, activeWorkspaceId, activeProfileId, profiles } = get()
    
    // Select a different workspace if deleting the active one
    const profile = profiles.find(p => p.id === activeProfileId)
    const remainingWorkspaces = workspaces.filter(w => w.id !== workspaceId)
    const newActiveWorkspace = activeWorkspaceId === workspaceId
      ? remainingWorkspaces.find(w => w.profile === profile?.name)
      : workspaces.find(w => w.id === activeWorkspaceId)

    set({
      workspaces: remainingWorkspaces,
      activeWorkspaceId: newActiveWorkspace?.id || null,
      activeWorkspaceData: newActiveWorkspace && USE_MOCK_DATA
        ? MOCK_WORKSPACE_DATA[newActiveWorkspace.id] || null
        : null,
    })

    // TODO: Delete file from Gist
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

      return {
        activeWorkspaceData: {
          ...state.activeWorkspaceData,
          links: [...state.activeWorkspaceData.links, newLink],
        },
      }
    })

    // Queue save
    get().saveWorkspace()
  },

  // Remove link
  removeLink: (linkId: string) => {
    set(state => {
      if (!state.activeWorkspaceData) return state

      return {
        activeWorkspaceData: {
          ...state.activeWorkspaceData,
          links: state.activeWorkspaceData.links.filter(l => l.id !== linkId),
        },
      }
    })

    // Queue save
    get().saveWorkspace()
  },

  // Update link
  updateLink: (linkId: string, updates: Partial<LinkItem>) => {
    set(state => {
      if (!state.activeWorkspaceData) return state

      return {
        activeWorkspaceData: {
          ...state.activeWorkspaceData,
          links: state.activeWorkspaceData.links.map(l =>
            l.id === linkId ? { ...l, ...updates } : l
          ),
        },
      }
    })

    // Queue save
    get().saveWorkspace()
  },

  // Toggle pin
  togglePinLink: (linkId: string) => {
    set(state => {
      if (!state.activeWorkspaceData) return state

      return {
        activeWorkspaceData: {
          ...state.activeWorkspaceData,
          links: state.activeWorkspaceData.links.map(l =>
            l.id === linkId ? { ...l, pinned: !l.pinned } : l
          ),
        },
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

      return {
        activeWorkspaceData: {
          ...state.activeWorkspaceData,
          links,
        },
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
        if (!state.activeWorkspaceData) return

        set({ isSaving: true })

        try {
          if (USE_MOCK_DATA) {
            // In mock mode, just update the mock data
            MOCK_WORKSPACE_DATA[state.activeWorkspaceData.id] = state.activeWorkspaceData
            console.log('Mock save:', state.activeWorkspaceData)
          } else {
            // TODO: Save to Gist
            // This will be implemented in Phase 3
          }
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
