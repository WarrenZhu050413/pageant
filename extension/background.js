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

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-region") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) startRegionCapture(tab.id);
    });
  }
});

// Handle messages from content script (hover button) and sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_IMAGE" && sender.tab) {
    handleImageSave(sender.tab.id, message.payload);
  }

  if (message.type === "START_CAPTURE") {
    startRegionCapture(message.tabId);
  }

  if (message.type === "REGION_SELECTED") {
    handleRegionCapture(sender.tab.id, message.selection);
  }

  if (message.type === "CAPTURE_CANCELLED") {
    // User pressed ESC - nothing to do
  }
});

// Start region capture mode
async function startRegionCapture(tabId) {
  // Send message to content script to show selection overlay
  chrome.tabs.sendMessage(tabId, { type: "START_SELECTION" });
}

// Handle the actual capture after selection is made
async function handleRegionCapture(tabId, selection) {
  try {
    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });

    // Crop the image using OffscreenCanvas
    const croppedBlob = await cropImage(dataUrl, selection);

    // Upload to Pageant
    const formData = new FormData();
    formData.append("files", croppedBlob, `capture-${Date.now()}.png`);

    const response = await fetch(`${PAGEANT_API}/api/upload`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) throw new Error("Upload failed");

    const result = await response.json();

    // Open side panel and show the captured image
    await chrome.sidePanel.open({ tabId: tabId });

    // Get tab info for context
    const tab = await chrome.tabs.get(tabId);

    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: "IMAGE_SELECTED",
        payload: {
          imageUrl: `${PAGEANT_API}/images/${result.images[0].id}`,
          pageUrl: tab.url,
          pageTitle: tab.title,
          saved: true  // Already saved, no need to save again
        }
      });
    }, 300);

  } catch (error) {
    console.error("Region capture failed:", error);
  }
}

// Crop image using OffscreenCanvas
async function cropImage(dataUrl, selection) {
  // Fetch the data URL to get a blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  // Create ImageBitmap with built-in cropping
  const bitmap = await createImageBitmap(
    blob,
    selection.x,
    selection.y,
    selection.width,
    selection.height
  );

  // Draw to OffscreenCanvas and export
  const canvas = new OffscreenCanvas(selection.width, selection.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  return await canvas.convertToBlob({ type: "image/png" });
}

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
