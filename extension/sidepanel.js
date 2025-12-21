// Pageant Scout - Side Panel Logic

const PAGEANT_API = "http://localhost:8765";

// DOM Elements
const statusEl = document.getElementById("status");
const mainEl = document.getElementById("main");
const emptyStateEl = document.getElementById("empty-state");

// State
let isConnected = false;

// Check backend connection
async function checkConnection() {
  try {
    const res = await fetch(`${PAGEANT_API}/api/health`, { method: "GET" });
    if (res.ok) {
      setConnectionStatus(true);
      return true;
    }
  } catch (e) {
    // Try /docs as fallback
    try {
      const res = await fetch(`${PAGEANT_API}/docs`);
      if (res.ok) {
        setConnectionStatus(true);
        return true;
      }
    } catch (e2) {
      // Both failed
    }
  }
  setConnectionStatus(false);
  return false;
}

function setConnectionStatus(connected) {
  isConnected = connected;
  statusEl.className = `status ${connected ? "online" : "offline"}`;
  statusEl.querySelector(".status-text").textContent = connected ? "Connected" : "Offline";
}

// Initialize
checkConnection();
setInterval(checkConnection, 5000);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "IMAGE_SELECTED") {
    window.addImageCard(message.payload);
  }
});

// Add image card to the stage (exposed for testing)
window.addImageCard = function addImageCard(payload) {
  // Hide empty state
  if (emptyStateEl) {
    emptyStateEl.style.display = "none";
  }

  const cardId = Date.now();
  const card = document.createElement("div");
  card.className = "card";
  card.id = `card-${cardId}`;
  card.dataset.imageUrl = payload.imageUrl;
  card.dataset.pageUrl = payload.pageUrl || "";
  card.dataset.pageTitle = payload.pageTitle || "";

  // Extract domain from URL for display
  let sourceDomain = "";
  try {
    sourceDomain = new URL(payload.pageUrl || payload.imageUrl).hostname;
  } catch (e) {
    sourceDomain = "Unknown source";
  }

  card.innerHTML = `
    <div class="card-image-container">
      <div class="shimmer" id="shimmer-${cardId}"></div>
      <img
        class="card-image loading"
        id="image-${cardId}"
        alt="Captured image"
      />
    </div>
    <div class="card-body">
      <div class="source" title="${escapeHtml(payload.pageUrl || "")}">
        From ${escapeHtml(sourceDomain)}
      </div>
      <div class="actions">
        <button class="btn btn-primary" id="save-btn-${cardId}" onclick="saveImage(${cardId})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17,21 17,13 7,13 7,21"/>
            <polyline points="7,3 7,8 15,8"/>
          </svg>
          Save to Library
        </button>
        <button class="btn btn-secondary" onclick="dismissCard(${cardId})" title="Dismiss">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Insert at top
  mainEl.insertBefore(card, mainEl.firstChild);

  // Load image via fetch (bypasses CSP restrictions)
  loadImageAsBlob(cardId, payload.imageUrl);
}

// Load image via fetch to bypass CSP restrictions on external images
async function loadImageAsBlob(cardId, imageUrl) {
  const imgEl = document.getElementById(`image-${cardId}`);
  const shimmerEl = document.getElementById(`shimmer-${cardId}`);

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Failed to fetch image");

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    imgEl.onload = () => {
      imgEl.classList.remove("loading");
      if (shimmerEl) shimmerEl.style.display = "none";
    };
    imgEl.onerror = () => {
      imgEl.classList.add("error");
      if (shimmerEl) shimmerEl.style.display = "none";
    };
    imgEl.src = objectUrl;
  } catch (e) {
    console.error("Image load error:", e);
    if (shimmerEl) shimmerEl.style.display = "none";
    imgEl.classList.add("error");
  }
}

// Save image to library
window.saveImage = async function(cardId) {
  const card = document.getElementById(`card-${cardId}`);
  const btn = document.getElementById(`save-btn-${cardId}`);

  if (!card || !btn) return;

  const imageUrl = card.dataset.imageUrl;
  const pageUrl = card.dataset.pageUrl;

  // Update button state
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving...';

  try {
    const res = await fetch(`${PAGEANT_API}/api/extension/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: imageUrl,
        pageUrl: pageUrl
      })
    });

    if (!res.ok) throw new Error("Save failed");

    // Success state
    btn.className = "btn btn-success";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
      Saved
    `;
  } catch (e) {
    console.error("Save error:", e);
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Error - Retry
    `;
  }
};

// Dismiss card
window.dismissCard = function(cardId) {
  const card = document.getElementById(`card-${cardId}`);
  if (card) {
    card.style.animation = "slideOut 0.2s ease-out forwards";
    setTimeout(() => {
      card.remove();
      // Show empty state if no cards left
      const cards = mainEl.querySelectorAll(".card");
      if (cards.length === 0 && emptyStateEl) {
        emptyStateEl.style.display = "flex";
      }
    }, 200);
  }
};

// Helper: Escape HTML
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Add slideOut animation
const style = document.createElement("style");
style.textContent = `
  @keyframes slideOut {
    to {
      opacity: 0;
      transform: translateX(20px);
    }
  }
`;
document.head.appendChild(style);
