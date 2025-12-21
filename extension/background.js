// Pageant Scout - Background Service Worker

const PAGEANT_API = "http://localhost:8765";

// Setup on install
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for images
  chrome.contextMenus.create({
    id: "save-to-pageant",
    title: "Save to Pageant",
    contexts: ["image"]
  });

  // Open side panel on extension icon click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-to-pageant" && info.srcUrl) {
    await handleImageSave(tab.id, {
      imageUrl: info.srcUrl,
      pageUrl: info.pageUrl || tab.url,
      pageTitle: tab.title
    });
  }
});

// Handle messages from content script (hover button)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_IMAGE" && sender.tab) {
    handleImageSave(sender.tab.id, message.payload);
  }
});

// Shared handler for saving images
async function handleImageSave(tabId, payload) {
  // Open side panel
  await chrome.sidePanel.open({ tabId: tabId });

  // Send image to side panel after a brief delay for panel to load
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: "IMAGE_SELECTED",
      payload: payload
    });
  }, 300);
}
