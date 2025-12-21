// Pageant Scout - Content Script
// Shows save button at bottom-right of images/videos on hover

(function() {
  // Avoid double injection
  if (window.__pageantScoutLoaded) return;
  window.__pageantScoutLoaded = true;

  // Create the hover button
  const button = document.createElement('div');
  button.id = 'pageant-scout-btn';
  button.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>
  `;

  // Styles
  const styles = document.createElement('style');
  styles.textContent = `
    #pageant-scout-btn {
      position: absolute;
      display: none;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: rgba(28, 27, 25, 0.9);
      color: #c4b18a;
      border-radius: 6px;
      cursor: pointer;
      z-index: 2147483647;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      transition: all 0.15s ease;
      pointer-events: auto;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    #pageant-scout-btn:hover {
      background: rgba(160, 138, 92, 0.95);
      color: #1c1b19;
      transform: scale(1.1);
    }
    #pageant-scout-btn.saving {
      pointer-events: none;
    }
    #pageant-scout-btn.saving svg {
      animation: pageant-spin 0.8s linear infinite;
    }
    #pageant-scout-btn.saved {
      background: rgba(106, 176, 136, 0.95);
      color: white;
    }
    @keyframes pageant-spin {
      to { transform: rotate(360deg); }
    }

    /* Wrapper to position button relative to media */
    .pageant-scout-wrapper {
      position: relative;
      display: inline-block;
    }
  `;

  document.head.appendChild(styles);
  document.body.appendChild(button);

  let currentTarget = null;
  let currentWrapper = null;

  // Get media source URL
  function getMediaSrc(element) {
    if (!element) return null;

    // Video element
    if (element.tagName === 'VIDEO') {
      return element.currentSrc || element.src || element.querySelector('source')?.src;
    }

    // Direct img tag
    if (element.tagName === 'IMG') {
      return element.currentSrc || element.src;
    }

    // Background image on element
    const bgImage = window.getComputedStyle(element).backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
      const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (match) return match[1];
    }

    // Picture element
    if (element.tagName === 'PICTURE') {
      const img = element.querySelector('img');
      if (img) return img.currentSrc || img.src;
    }

    // Canvas - convert to data URL
    if (element.tagName === 'CANVAS') {
      try {
        return element.toDataURL('image/png');
      } catch (e) {
        return null; // CORS blocked
      }
    }

    // Data attributes for lazy loading
    return element.dataset?.src || element.dataset?.lazySrc || null;
  }

  // Check if element is saveable media
  function isSaveableMedia(element) {
    if (!element) return false;

    const tag = element.tagName;
    const rect = element.getBoundingClientRect();
    const minSize = 60; // Lowered threshold for grid previews

    // Skip if too small
    if (rect.width < minSize || rect.height < minSize) return false;

    // Direct media elements
    if (tag === 'IMG' || tag === 'VIDEO' || tag === 'PICTURE' || tag === 'CANVAS') {
      return true;
    }

    // Check for background image
    const style = window.getComputedStyle(element);
    const bgImage = style.backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
      // Make sure it's not a gradient or tiny icon
      const bgSize = style.backgroundSize;
      if (bgSize !== 'auto' || rect.width >= 100) {
        return true;
      }
    }

    return false;
  }

  // Find the media element from event target (walk up DOM)
  function findMediaElement(target) {
    let el = target;
    let depth = 0;
    const maxDepth = 8;

    // First: walk UP the DOM tree
    while (el && depth < maxDepth) {
      if (isSaveableMedia(el)) return el;
      el = el.parentElement;
      depth++;
    }

    // Second: check if target contains media (children)
    if (target) {
      const img = target.querySelector('img');
      if (img && isSaveableMedia(img)) return img;

      const video = target.querySelector('video');
      if (video && isSaveableMedia(video)) return video;
    }

    // Third: check siblings when target is an overlay element
    // Sites like cosmos.so use buttons, Pinterest uses DIV overlays
    // Check parent's descendants for media when target isn't media itself
    if (target) {
      const targetTag = target.tagName;
      const isLikelyOverlay = targetTag === 'BUTTON' || targetTag === 'A' || targetTag === 'DIV' || targetTag === 'SPAN';

      if (isLikelyOverlay) {
        let parent = target.parentElement;
        for (let i = 0; i < 4 && parent; i++) {
          // Find img/video in parent that is large enough and not the target itself
          const img = parent.querySelector('img');
          if (img && img !== target && isSaveableMedia(img)) {
            // Verify the target overlaps with the image (is actually an overlay)
            const targetRect = target.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();
            const overlaps = !(targetRect.right < imgRect.left ||
                              targetRect.left > imgRect.right ||
                              targetRect.bottom < imgRect.top ||
                              targetRect.top > imgRect.bottom);
            if (overlaps) return img;
          }

          const video = parent.querySelector('video');
          if (video && video !== target && isSaveableMedia(video)) {
            const targetRect = target.getBoundingClientRect();
            const vidRect = video.getBoundingClientRect();
            const overlaps = !(targetRect.right < vidRect.left ||
                              targetRect.left > vidRect.right ||
                              targetRect.bottom < vidRect.top ||
                              targetRect.top > vidRect.bottom);
            if (overlaps) return video;
          }

          parent = parent.parentElement;
        }
      }
    }

    return null;
  }

  // Position button at bottom-right of element
  function showButtonOnElement(mediaEl) {
    if (currentTarget === mediaEl) return; // Already showing

    currentTarget = mediaEl;

    const rect = mediaEl.getBoundingClientRect();

    // Position at bottom-right corner with padding
    const padding = 8;
    button.style.position = 'fixed';
    button.style.left = (rect.right - 32 - padding) + 'px';
    button.style.top = (rect.bottom - 32 - padding) + 'px';
    button.style.display = 'flex';

    // Reset state
    button.className = '';
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 5v14M5 12l7 7 7-7"/>
      </svg>
    `;
  }

  function hideButton() {
    button.style.display = 'none';
    currentTarget = null;
  }

  // Throttle function
  function throttle(fn, wait) {
    let lastTime = 0;
    return function(...args) {
      const now = Date.now();
      if (now - lastTime >= wait) {
        lastTime = now;
        fn.apply(this, args);
      }
    };
  }

  // Mouse move handler (throttled)
  const handleMouseMove = throttle((e) => {
    // Don't hide if hovering on button
    if (e.target === button || button.contains(e.target)) return;

    const mediaEl = findMediaElement(e.target);

    if (mediaEl) {
      const src = getMediaSrc(mediaEl);
      if (src && !src.startsWith('data:image/gif')) { // Skip tiny GIFs (tracking pixels)
        showButtonOnElement(mediaEl);
        return;
      }
    }

    // Hide if not hovering media
    if (currentTarget) {
      const rect = currentTarget.getBoundingClientRect();
      const inBounds = (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
      if (!inBounds) {
        hideButton();
      }
    }
  }, 50);

  document.addEventListener('mousemove', handleMouseMove);

  // Keep button visible when hovering over it
  button.addEventListener('mouseenter', () => {
    // Keep current target
  });

  button.addEventListener('mouseleave', (e) => {
    // Check if moved back to the media element
    const mediaEl = findMediaElement(e.relatedTarget);
    if (mediaEl !== currentTarget) {
      hideButton();
    }
  });

  // Click handler
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentTarget) return;

    const mediaUrl = getMediaSrc(currentTarget);
    if (!mediaUrl) {
      console.error('Pageant Scout: Could not get media URL');
      return;
    }

    // Update button state - saving
    button.className = 'saving';
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
      </svg>
    `;

    // Send to background script
    try {
      await chrome.runtime.sendMessage({
        type: "SAVE_IMAGE",
        payload: {
          imageUrl: mediaUrl,
          pageUrl: window.location.href,
          pageTitle: document.title
        }
      });

      // Success state
      button.className = 'saved';
      button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
      `;

      setTimeout(hideButton, 1200);
    } catch (err) {
      console.error('Pageant Scout error:', err);
      hideButton();
    }
  });

  // Handle scroll - update button position
  window.addEventListener('scroll', () => {
    if (currentTarget) {
      showButtonOnElement(currentTarget);
    }
  }, { passive: true });

  console.log('Pageant Scout: Ready');

  // ==========================================
  // Region Capture Selection UI
  // ==========================================

  let selectionOverlay = null;
  let selectionBox = null;
  let isSelecting = false;
  let startX = 0;
  let startY = 0;

  // Inject selection styles
  const selectionStyles = document.createElement('style');
  selectionStyles.textContent = `
    .pageant-capture-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      cursor: crosshair;
      z-index: 2147483646;
      user-select: none;
    }

    .pageant-selection-box {
      position: fixed;
      border: 2px solid #a08a5c;
      background: rgba(160, 138, 92, 0.15);
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
      z-index: 2147483647;
      pointer-events: none;
    }

    .pageant-selection-box::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 1px dashed rgba(255, 255, 255, 0.5);
    }

    .pageant-selection-hint {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      background: rgba(28, 27, 25, 0.95);
      color: #f5f3f0;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      border-radius: 8px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(8px);
    }

    .pageant-selection-hint kbd {
      display: inline-block;
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      font-family: inherit;
      margin: 0 2px;
    }
  `;
  document.head.appendChild(selectionStyles);

  // Listen for start selection message from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "START_SELECTION") {
      startSelection();
    }
  });

  function startSelection() {
    // Create overlay
    selectionOverlay = document.createElement('div');
    selectionOverlay.className = 'pageant-capture-overlay';

    // Create hint
    const hint = document.createElement('div');
    hint.className = 'pageant-selection-hint';
    hint.innerHTML = 'Drag to select region • <kbd>ESC</kbd> to cancel';
    selectionOverlay.appendChild(hint);

    document.body.appendChild(selectionOverlay);

    // Add event listeners
    selectionOverlay.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
  }

  function onMouseDown(e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;

    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.className = 'pageant-selection-box';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    document.body.appendChild(selectionBox);

    // Hide the hint when dragging starts
    const hint = selectionOverlay.querySelector('.pageant-selection-hint');
    if (hint) hint.style.opacity = '0';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!isSelecting || !selectionBox) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
  }

  function onMouseUp(e) {
    if (!isSelecting) return;
    isSelecting = false;

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    // Clean up UI
    cleanup();

    // Only send if selection is meaningful (at least 10x10 pixels)
    if (width >= 10 && height >= 10) {
      // Account for device pixel ratio for accurate capture
      const dpr = window.devicePixelRatio || 1;

      chrome.runtime.sendMessage({
        type: "REGION_SELECTED",
        selection: {
          x: Math.round(left * dpr),
          y: Math.round(top * dpr),
          width: Math.round(width * dpr),
          height: Math.round(height * dpr)
        }
      });
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ type: "CAPTURE_CANCELLED" });
    }
  }

  function cleanup() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    if (selectionOverlay) {
      selectionOverlay.remove();
      selectionOverlay = null;
    }
    if (selectionBox) {
      selectionBox.remove();
      selectionBox = null;
    }
    isSelecting = false;
  }
})();
