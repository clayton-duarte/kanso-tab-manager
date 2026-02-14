/**
 * Chrome Tabs Utility
 * Handles tab operations for workspace switching
 */

export interface TabInfo {
  url: string;
  title?: string;
  pinned?: boolean;
}

/**
 * Check if we're running in a Chrome extension context
 */
export function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.tabs;
}

/**
 * Get the current extension tab (our dashboard)
 */
export async function getExtensionTab(): Promise<chrome.tabs.Tab | null> {
  if (!isExtensionContext()) return null;

  // Try multiple methods to find the extension tab
  const extensionUrl = chrome.runtime.getURL('');
  const tabs = await chrome.tabs.query({ currentWindow: true });

  // Find tab that starts with our extension URL
  const extensionTab = tabs.find((tab) => tab.url?.startsWith(extensionUrl));

  return extensionTab || null;
}

/**
 * Close all tabs in the current window except the extension tab and pinned tabs
 * The extension tab is identified by:
 * 1. Being the currently active tab (user is viewing dashboard)
 * 2. Having our extension URL
 */
export async function closeAllTabs(): Promise<void> {
  if (!isExtensionContext()) return;

  // Get the currently active tab - this is our dashboard
  const [activeTab] = await chrome.tabs.query({
    currentWindow: true,
    active: true,
  });
  const activeTabId = activeTab?.id;

  // Also try to find by extension URL as backup
  const extensionUrl = chrome.runtime.getURL('');
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const extensionTabByUrl = allTabs.find((tab) =>
    tab.url?.startsWith(extensionUrl)
  );

  // Filter out the active tab, extension tab by URL, and pinned tabs
  const tabIdsToClose = allTabs
    .filter(
      (tab) =>
        tab.id !== activeTabId &&
        tab.id !== extensionTabByUrl?.id &&
        tab.id !== undefined &&
        !tab.pinned // Keep pinned tabs
    )
    .map((tab) => tab.id as number);

  if (tabIdsToClose.length > 0) {
    await chrome.tabs.remove(tabIdsToClose);
  }
}

/**
 * Open a tab without loading it immediately
 * Chrome will lazy-load the tab when the user clicks on it
 */
export async function openSuspendedTab(
  tab: TabInfo,
  index?: number
): Promise<chrome.tabs.Tab | null> {
  if (!isExtensionContext()) return null;

  try {
    // Create the tab inactive - Chrome won't fully load it until clicked
    const createdTab = await chrome.tabs.create({
      url: tab.url,
      active: false,
      pinned: tab.pinned ?? false,
      index,
    });

    // Note: We don't call chrome.tabs.discard() because:
    // 1. It can cause about:blank if called before the tab loads
    // 2. Chrome already lazy-loads inactive tabs in most cases
    // 3. The discardAutoDiscardable property handles this better

    return createdTab;
  } catch (error) {
    console.error('Failed to create tab:', error);
    return null;
  }
}

/**
 * Open multiple tabs in order, all placed after the dashboard tab
 * Returns after all tabs are created
 */
export async function openTabsInOrder(tabs: TabInfo[]): Promise<void> {
  if (!isExtensionContext() || tabs.length === 0) return;

  // Get the currently active tab (dashboard) to place new tabs after it
  const [activeTab] = await chrome.tabs.query({
    currentWindow: true,
    active: true,
  });
  
  // Start after the active (dashboard) tab
  const startIndex = activeTab?.index !== undefined ? activeTab.index + 1 : 1;

  // Open tabs sequentially to maintain order
  for (let i = 0; i < tabs.length; i++) {
    await openSuspendedTab(tabs[i], startIndex + i);
  }
}

/**
 * Switch workspace: close all tabs and open new ones
 * This is the main function called when switching workspaces
 */
export async function switchWorkspaceTabs(tabs: TabInfo[]): Promise<void> {
  if (!isExtensionContext()) return;

  // Close all existing tabs first
  await closeAllTabs();

  // Open new tabs in order, suspended
  await openTabsInOrder(tabs);
}

/**
 * Get all tabs in the current window (excluding extension tab and pinned tabs)
 * Used to save current tabs to a workspace
 * Pinned tabs are excluded because they're preserved across workspace switches
 */
export async function getCurrentTabs(): Promise<TabInfo[]> {
  if (!isExtensionContext()) return [];

  const extensionTab = await getExtensionTab();
  const extensionTabId = extensionTab?.id;

  const tabs = await chrome.tabs.query({ currentWindow: true });

  return tabs
    .filter(
      (tab) =>
        tab.id !== extensionTabId &&
        tab.url &&
        !tab.pinned // Exclude pinned tabs - they're preserved
    )
    .map((tab) => ({
      url: tab.url!,
      title: tab.title,
      pinned: false, // All workspace tabs are unpinned
    }));
}
