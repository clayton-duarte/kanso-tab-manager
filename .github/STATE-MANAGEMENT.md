# Kanso Tab Manager - State Management Architecture

## Overview

Kanso uses an **offline-first** architecture with **optimistic updates** and **timestamp-based conflict resolution**. The system prioritizes instant UI responsiveness while maintaining eventual consistency with GitHub Gist as the source of truth.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KANSO STATE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐  │
│    │   Browser    │     │   Zustand    │     │    chrome.storage.local  │  │
│    │   New Tab    │◄───►│    Store     │◄───►│  ┌────────┐ ┌─────────┐  │  │
│    │     UI       │     │  (In-Memory) │     │  │Session │ │Portable │  │  │
│    └──────────────┘     └──────────────┘     │  └────────┘ └─────────┘  │  │
│                               ▲               └──────────────────────────┘  │
│                               │                           ▲                 │
│                               │ Sync (3s debounce)        │ Instant cache   │
│                               ▼                           ▼                 │
│                        ┌──────────────┐          ┌──────────────────────┐  │
│                        │   GitHub     │◄────────►│     GitHub Gist      │  │
│                        │     API      │          │  (Source of Truth)   │  │
│                        └──────────────┘          └──────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Classification

### Session State (Non-Portable)

**Storage Key:** `kanso_session`

Session state is **device-specific** and should NOT sync between devices. This data represents the user's current context on this specific browser instance.

```typescript
interface SessionState {
  pat: string | null           // GitHub Personal Access Token
  gistId: string | null        // Connected Gist ID
  activeProfileId: string | null
  activeWorkspaceId: string | null
  profileWorkspaceMap: Record<string, string>  // Last workspace per profile
}
```

**Why non-portable:**
- PAT is sensitive and device-specific
- Active selections should be independent per device
- Profile/workspace navigation history is personal preference

### Portable State (Synced)

**Storage Key:** `kanso_portable`

Portable state syncs to GitHub Gist and should be consistent across all devices.

```typescript
interface PortableState {
  profiles: Profile[]
  workspaces: WorkspaceMeta[]
  workspaceDataCache: Record<string, WorkspaceData>
}
```

**What syncs:**
- Profile configurations (name, accent color)
- Workspace metadata and content
- Links, their order, and pin status

---

## Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STORAGE LAYERS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: In-Memory (Zustand Store)                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ • Fastest access (< 1ms)                                              │ │
│  │ • Lost on tab close                                                   │ │
│  │ • Primary source for UI rendering                                     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼ Write-through                          │
│  LAYER 2: chrome.storage.local                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ • Persists across tab closes (< 10ms)                                 │ │
│  │ • ~5MB limit per extension                                            │ │
│  │ • Split into kanso_session + kanso_portable                           │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼ 3-second debounce                      │
│  LAYER 3: GitHub Gist (Remote)                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ • Source of truth for portable data                                   │ │
│  │ • Cross-device sync                                                   │ │
│  │ • Requires network                                                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Offline-First Behavior

### Initialization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         APP INITIALIZATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. LOAD SESSION (instant)                                                  │
│     ┌──────────────────┐                                                   │
│     │ chrome.storage   │──► Has PAT + GistId? ──► No ──► Show Welcome      │
│     │ kanso_session    │                    │                               │
│     └──────────────────┘                    ▼ Yes                           │
│                                                                             │
│  2. LOAD PORTABLE CACHE (instant, no network)                               │
│     ┌──────────────────┐                                                   │
│     │ chrome.storage   │──► Render UI immediately with cached data         │
│     │ kanso_portable   │                                                   │
│     └──────────────────┘                                                   │
│              │                                                              │
│              ▼                                                              │
│  3. BACKGROUND SYNC (non-blocking)                                          │
│     ┌──────────────────┐                                                   │
│     │ Fetch from Gist  │──► Compare timestamps ──► Merge newer data        │
│     │ (async)          │                                                   │
│     └──────────────────┘                                                   │
│                                                                             │
│  RESULT: UI appears instantly, updates silently if remote has changes      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Never block on network** - UI renders immediately from cache
2. **Sync errors are warnings** - Never break the experience for sync failures
3. **Optimistic updates** - Apply changes locally first, sync in background
4. **Graceful degradation** - Full functionality offline (except initial setup)

---

## SWR (Stale-While-Revalidate) Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SWR SYNC FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER OPENS NEW TAB                                                         │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  STALE: Show cached data immediately (< 10ms)                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         ▼ (async, non-blocking)                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  REVALIDATE: Fetch fresh data from Gist                              │  │
│  │                                                                       │  │
│  │  For each workspace:                                                  │  │
│  │    local.updatedAt > remote.updatedAt? ──► Push local to Gist        │  │
│  │    remote.updatedAt > local.updatedAt? ──► Use remote data           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  UPDATE: Merge changes into store + cache (UI updates if changed)   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cache Invalidation

- **On sync:** All workspace data is fetched fresh from Gist
- **Timestamps control merge:** `updatedAt` field determines which version wins
- **No TTL:** Cache is valid until explicitly invalidated by sync

---

## Timestamp-Based Conflict Resolution

Every `WorkspaceData` includes an `updatedAt` timestamp that updates on any modification.

```typescript
interface WorkspaceData {
  id: string
  name: string
  profile: string
  createdAt: number
  updatedAt: number    // ◄── Conflict resolution key
  links: LinkItem[]
}
```

### Conflict Resolution Algorithm

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONFLICT RESOLUTION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  During sync, for each workspace:                                           │
│                                                                             │
│    local.updatedAt    remote.updatedAt    Action                           │
│    ─────────────────────────────────────────────────                        │
│    1707900000000  >   1707899000000   →   Keep local, push to Gist         │
│    1707899000000  <   1707900000000   →   Use remote, discard local        │
│    1707900000000  ==  1707900000000   →   Use remote (no changes)          │
│                                                                             │
│  IMPORTANT: This is a "last-write-wins" strategy.                          │
│  No field-level merging - entire workspace data is replaced.               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### When `updatedAt` is Set

| Action | Sets updatedAt |
|--------|----------------|
| `addLink` | ✅ Yes |
| `removeLink` | ✅ Yes |
| `updateLink` | ✅ Yes |
| `togglePinLink` | ✅ Yes |
| `reorderLinks` | ✅ Yes |
| `renameWorkspace` | ✅ Yes |
| `createWorkspace` | ✅ Yes (via `createdAt = updatedAt`) |

---

## Mutation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MUTATION FLOW                                       │
│                      (e.g., addLink, renameWorkspace)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER ACTION (e.g., clicks "Add Link")                                      │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. OPTIMISTIC UPDATE                                                │   │
│  │     • Update Zustand store immediately                               │   │
│  │     • Set updatedAt = Date.now()                                     │   │
│  │     • UI reflects change instantly                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  2. PERSIST TO LOCAL CACHE (instant)                                 │   │
│  │     • savePortable(...) writes to chrome.storage.local               │   │
│  │     • Survives tab close                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  3. QUEUE GIST SYNC (3-second debounce)                              │   │
│  │     • Batches rapid changes                                          │   │
│  │     • Non-blocking, happens in background                            │   │
│  │     • Failures show warning, don't break UX                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Gist File Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GIST FILE NAMING                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Profile].json                    Profile settings                         │
│  ├── name: string                                                          │
│  ├── accentColor: "gray" | "red" | ...                                     │
│  ├── createdAt: number                                                     │
│  └── workspaceOrder: string[]      Ordered workspace IDs                   │
│                                                                             │
│  [Profile]__[Workspace].json       Workspace data                           │
│  ├── id: string                                                            │
│  ├── name: string                  Display name (may differ from filename) │
│  ├── profile: string                                                       │
│  ├── createdAt: number                                                     │
│  ├── updatedAt: number             Conflict resolution timestamp           │
│  └── links: LinkItem[]                                                     │
│                                                                             │
│  EXAMPLES:                                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Personal.json                     Profile settings for "Personal"         │
│  Personal__Default.json            "Default" workspace in "Personal"       │
│  Personal__Work-Tasks.json         "Work Tasks" workspace (encoded)        │
│  Work.json                         Profile settings for "Work"             │
│  Work__Projects.json               "Projects" workspace in "Work"          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Important: Filename vs Display Name

The filename is generated when the workspace is created and **never changes**. The display name is stored inside the JSON and can be renamed freely. During sync, the `name` field inside the JSON takes precedence over the filename.

---

## Error Handling Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NETWORK ERRORS                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Show non-blocking SyncStatusBanner                               │   │
│  │  • Continue working offline with cached data                         │   │
│  │  • Retry sync on next tab open                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PAT EXPIRED / INVALID                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Set isAuthenticated = false                                       │   │
│  │  • Show re-authentication prompt                                     │   │
│  │  • Keep cached data accessible offline                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  GIST NOT FOUND                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Clear credentials                                                 │   │
│  │  • Redirect to setup flow                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  SAVE FAILURES                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Show warning in SyncStatusBanner                                  │   │
│  │  • Data preserved in local cache                                     │   │
│  │  • Will sync on next successful connection                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **chrome.storage.local over IndexedDB** | Simpler API, sufficient for our data size (~5MB limit), better extension support |
| **Split session/portable** | PAT security, per-device navigation state |
| **3-second debounce for sync** | Batch rapid changes, reduce API calls |
| **Immediate cache writes** | Instant persistence, survives unexpected tab close |
| **Last-write-wins conflict resolution** | Simple, predictable, sufficient for single-user use case |
| **Workspace name in JSON, not filename** | Allows renaming without breaking file references |
| **`updatedAt` timestamp** | Enables proper conflict resolution during sync |
| **Non-blocking sync** | Never degrade UX for network issues |

---

## State Store Structure (Zustand)

```typescript
interface AppStore {
  // ═══════════════════════════════════════════════════════════════════════
  // SESSION STATE (non-portable, device-specific)
  // ═══════════════════════════════════════════════════════════════════════
  pat: string | null
  gistId: string | null
  activeProfileId: string | null
  activeWorkspaceId: string | null
  profileWorkspaceMap: Record<string, string>

  // ═══════════════════════════════════════════════════════════════════════
  // PORTABLE STATE (synced to Gist)
  // ═══════════════════════════════════════════════════════════════════════
  profiles: Profile[]
  workspaces: WorkspaceMeta[]
  workspaceDataCache: Record<string, WorkspaceData>
  lastSyncedAt: number | null

  // ═══════════════════════════════════════════════════════════════════════
  // UI STATE (transient, not persisted)
  // ═══════════════════════════════════════════════════════════════════════
  isInitializing: boolean
  isAuthenticated: boolean
  syncError: string | null
  isSyncing: boolean
  isSaving: boolean
  accentColor: AccentColor
}
```

---

## Summary Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        ┌───────────────┐                                   │
│                        │   User Opens  │                                   │
│                        │   New Tab     │                                   │
│                        └───────┬───────┘                                   │
│                                │                                            │
│            ┌───────────────────┼───────────────────┐                       │
│            ▼                   │                   ▼                       │
│    ┌───────────────┐           │           ┌───────────────┐               │
│    │ Load Session  │           │           │ Load Portable │               │
│    │ (PAT, GistId) │           │           │ (Profiles,    │               │
│    └───────┬───────┘           │           │  Workspaces)  │               │
│            │                   │           └───────┬───────┘               │
│            └───────────────────┼───────────────────┘                       │
│                                │                                            │
│                                ▼                                            │
│                   ┌────────────────────────┐                               │
│                   │   Render UI Instantly  │ ◄─── Stale data OK            │
│                   │   (from cache)         │                               │
│                   └────────────┬───────────┘                               │
│                                │                                            │
│                                ▼ (async, background)                        │
│                   ┌────────────────────────┐                               │
│                   │   Sync with Gist       │                               │
│                   │   • Fetch all files    │                               │
│                   │   • Compare timestamps │                               │
│                   │   • Merge newer data   │                               │
│                   └────────────┬───────────┘                               │
│                                │                                            │
│                                ▼                                            │
│                   ┌────────────────────────┐                               │
│                   │   Update Store + Cache │                               │
│                   │   (if changes found)   │                               │
│                   └────────────────────────┘                               │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│                   USER MAKES A CHANGE                                       │
│                                │                                            │
│                                ▼                                            │
│                   ┌────────────────────────┐                               │
│                   │   Optimistic Update    │ ◄─── Instant                  │
│                   │   • Update store       │                               │
│                   │   • Set updatedAt      │                               │
│                   └────────────┬───────────┘                               │
│                                │                                            │
│                                ▼                                            │
│                   ┌────────────────────────┐                               │
│                   │   Save to Local Cache  │ ◄─── Instant                  │
│                   │   (chrome.storage)     │                               │
│                   └────────────┬───────────┘                               │
│                                │                                            │
│                                ▼ (3-second debounce)                        │
│                   ┌────────────────────────┐                               │
│                   │   Sync to Gist         │ ◄─── Background               │
│                   │   (non-blocking)       │                               │
│                   └────────────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
