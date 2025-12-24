/**
 * Test interacting with the Pageant Scout extension via Playwright
 */

import { chromium } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, 'extension');

async function main() {
  const userDataDir = '/tmp/playwright-ext-interact-' + Date.now();

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
  });

  console.log('✓ Browser launched');

  // Wait for extension to load
  await new Promise(r => setTimeout(r, 2000));

  // Get extension ID from service worker
  const workers = context.serviceWorkers();
  let extId: string | undefined;
  for (const w of workers) {
    if (w.url().includes('chrome-extension://')) {
      extId = w.url().split('/')[2];
      break;
    }
  }

  if (!extId) {
    console.log('❌ Could not find extension ID');
    await context.close();
    return;
  }

  console.log('✓ Extension ID:', extId);

  // Open the side panel page directly
  const sidePanelPage = await context.newPage();
  await sidePanelPage.goto(`chrome-extension://${extId}/sidepanel.html`);
  console.log('✓ Opened side panel');

  // Wait for backend connection status
  const isConnected = await sidePanelPage.waitForSelector('.online', { timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  console.log(isConnected ? '✓ Backend connected' : '⚠ Backend offline (start with: make backend)');

  // Simulate what happens when user right-clicks an image
  const testImageUrl = 'https://picsum.photos/id/237/400/300'; // A cute dog

  console.log('\n📤 Simulating "Save to Pageant Scout" on an image...');

  // Call addImageCard directly via page.evaluate
  await sidePanelPage.evaluate((imageUrl) => {
    const payload = {
      imageUrl: imageUrl,
      pageUrl: 'https://example.com/test-page',
      pageTitle: 'Test Page'
    };

    // @ts-ignore - addImageCard is defined in sidepanel.js
    if (typeof addImageCard === 'function') {
      // @ts-ignore
      addImageCard(payload);
    } else {
      console.log('addImageCard not found, simulating message...');
      // Simulate the chrome.runtime message
      const event = new CustomEvent('test-image', { detail: payload });
      window.dispatchEvent(event);
    }
  }, testImageUrl);

  // Wait for image to load, then take screenshot
  await new Promise(r => setTimeout(r, 2000));
  await sidePanelPage.screenshot({ path: 'sidepanel-with-card.png' });
  console.log('✓ Screenshot: sidepanel-with-card.png');

  // Wait for analysis if backend is connected
  if (isConnected) {
    console.log('⏳ Waiting for Gemini analysis...');
    await new Promise(r => setTimeout(r, 5000));
    await sidePanelPage.screenshot({ path: 'sidepanel-analyzed.png' });
    console.log('✓ Screenshot after analysis: sidepanel-analyzed.png');
  }

  // Also open cosmos.so to test hover button
  const testPage = await context.newPage();
  await testPage.goto('https://www.cosmos.so/e/12553304');
  console.log('\n✓ Opened cosmos.so');
  console.log('💡 Hover over an image - a "Save" button should appear!');

  console.log('\n🎯 Browser staying open for 2 minutes. Press Ctrl+C to exit.');
  await new Promise(r => setTimeout(r, 120000));

  await context.close();
}

main().catch(console.error);
