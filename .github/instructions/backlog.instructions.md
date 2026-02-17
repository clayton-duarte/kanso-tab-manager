---
applyTo: ".github/instructions/**"
---

# Backlog Ideas

Future feature ideas and brainstorming notes for Kanso Tab Manager.

---

## Bookmark-Based Sync (Alternative to GitHub Gist)

**Status:** Brainstorm / Research

### Concept

Use Chrome's `chrome.bookmarks` API as an alternative sync mechanism instead of GitHub Gist.

### Chrome Bookmarks API Capabilities

With the `bookmarks` permission, an extension can:
- Create/Read/Update/Delete bookmarks and folders
- Move bookmarks between folders
- Search all bookmarks
- Listen to events (onCreated, onRemoved, onChanged, onMoved)
- Import/Export entire bookmark trees

### How Google Syncs Bookmarks

- Stored in Google's Sync servers (same as Chrome settings, passwords)
- Requires user to be signed into Chrome with a Google account
- Sync is real-time - changes propagate within seconds
- Uses encryption (optional passphrase for extra security)

### Bookmark Data Structure

```typescript
{
  id: string;           // Chrome-assigned
  parentId: string;     // Folder it belongs to
  index: number;        // Position in folder
  title: string;        // Display name (any text)
  url?: string;         // Only for bookmarks, not folders
  dateAdded: number;    // Timestamp
}
```

### Encoding Strategy

Store workspace data in bookmark URLs using data URIs or fake URLs:

```typescript
// Option 1: Data URI
Title: "Kanso:Profile:Work"
URL: data:application/json,{"workspaces":[...],"pins":[...]}

// Option 2: Fake URL with query params
URL: https://kanso.local/?data=base64encodedJSON
```

### Pros

- **Free sync** via Google - no GitHub PAT needed
- **Instant** cross-device availability
- **No rate limits** like GitHub API
- Users already trust Chrome with bookmarks
- Works offline

### Cons

- Pollutes user's bookmark bar/menu
- Only `title` and `url` fields available
- Need to encode workspace data into URLs
- No backup/version history
- Users might accidentally delete/move Kanso bookmarks

### Implementation Options

1. **Full replacement** - Use bookmarks instead of Gist entirely
2. **Hybrid approach** - Keep Gist as primary, offer bookmarks as lightweight alternative
3. **Hidden folder** - Store Kanso data in a folder users don't interact with

### Open Questions

- Maximum URL length for data URIs in bookmarks?
- How to handle conflicts if user edits on multiple devices simultaneously?
- Can we hide the Kanso bookmark folder from the bookmark bar UI?

---

## Chrome Side Panel Integration

**Status:** Brainstorm / Research

### Concept

Use Chrome's Side Panel API to provide a lightweight, always-accessible companion UI alongside the main New Tab dashboard.

### Side Panel API Capabilities

**What you CAN control:**
- Full control over content (HTML/CSS/JS)
- Enable/disable per tab via `chrome.sidePanel.setOptions()`
- Programmatic open (requires user gesture)
- Different content per URL pattern
- Title and icon

**What you CANNOT control:**
- Position (always right side)
- Width (user controls via drag, ~300-600px)
- Force auto-open without user click
- Overlay mode (cannot float over page)
- Multiple panels (only one extension panel visible at a time)

### Implementation

```json
// manifest.json
{
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "sidepanel.html"
  }
}
```

```typescript
// Enable side panel on extension icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Open programmatically (must be from user gesture)
chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });

// Context-specific panels
chrome.sidePanel.setOptions({
  tabId: tabId,
  path: 'custom-panel.html',
  enabled: true
});
```

### Use Cases for Kanso

1. **Side Panel as Quick Access**
   - Quick view of current workspace links
   - "Add this page" button always accessible
   - Small pinned links section
   - One-click workspace switching

2. **Hybrid Approach (Recommended)**
   - Keep New Tab as full dashboard for workspace management
   - Side Panel as lightweight companion for quick actions
   - Links clicked in side panel open in main browser area

3. **Context-Aware Assistant**
   - When on any page, show "Add to workspace" button
   - Floating quick-add without leaving current page

### Comparison: New Tab vs Side Panel

| Aspect | New Tab Override | Side Panel |
|--------|------------------|------------|
| Access | Open new tab | Click icon |
| Persistence | Lost on navigation | Stays open across tabs |
| Context | Dedicated view | Alongside any page |
| Real estate | Full page | ~300-600px wide |
| Link behavior | Opens in same/new tab | Opens in main area |

### Pros

- Always one click away without taking over current page
- Persists across tab navigation
- Natural place for "add current tab" action
- Doesn't interrupt browsing flow

### Cons

- Only ~300-600px width (user-controlled)
- Cannot force open on install
- Only one extension panel visible at a time
- Not supported on mobile Chrome
- Requires explicit incognito permission

### Open Questions

- Should side panel share state with New Tab page or be independent?
- What's the minimal useful feature set for the side panel?
- How to handle workspace switching - sync with main dashboard?
- Should clicking a link in side panel focus existing tab or open new?
