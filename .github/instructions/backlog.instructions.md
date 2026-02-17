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
