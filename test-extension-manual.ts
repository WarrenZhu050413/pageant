/**
 * Manual test script for Pageant Scout extension with Playwright
 * Run with: npx tsx test-extension-manual.ts
 */

import { chromium } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, 'extension');

async function testExtensionLoading() {
  console.log('🚀 Testing Playwright with Chrome extension...\n');
  console.log('Extension path:', EXTENSION_PATH);

  // Key requirement: Must use launchPersistentContext for extensions
  const userDataDir = '/tmp/playwright-extension-test-' + Date.now();

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Extensions REQUIRE headed mode
    channel: 'chromium', // Use bundled Chromium
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
    ignoreDefaultArgs: ['--disable-extensions'], // Key: prevent conflict
    timeout: 30000,
  });

  console.log('✓ Browser launched with extension\n');

  // Wait for service worker to register
  let extensionId: string | undefined;

  // Method 1: Wait for service worker event
  const serviceWorkerPromise = new Promise<string>((resolve) => {
    context.on('serviceworker', worker => {
      const url = worker.url();
      if (url.includes('chrome-extension://')) {
        resolve(url.split('/')[2]);
      }
    });
  });

  // Method 2: Check existing service workers
  await new Promise(r => setTimeout(r, 2000));
  const serviceWorkers = context.serviceWorkers();

  for (const worker of serviceWorkers) {
    const url = worker.url();
    if (url.includes('chrome-extension://')) {
      extensionId = url.split('/')[2];
      break;
    }
  }

  // Wait for service worker if not found yet
  if (!extensionId) {
    console.log('Waiting for service worker...');
    extensionId = await Promise.race([
      serviceWorkerPromise,
      new Promise<undefined>(r => setTimeout(() => r(undefined), 5000))
    ]);
  }

  console.log('Service workers found:', context.serviceWorkers().length);

  if (extensionId) {
    console.log('\n✓ Extension ID:', extensionId);

    // Open the side panel page directly
    const sidePanelPage = await context.newPage();
    const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
    await sidePanelPage.goto(sidePanelUrl);
    console.log('✓ Opened side panel page:', sidePanelUrl);

    // Take screenshot
    await sidePanelPage.screenshot({ path: 'extension-test-sidepanel.png' });
    console.log('✓ Screenshot saved: extension-test-sidepanel.png');

    // Get page content
    const title = await sidePanelPage.title();
    const heading = await sidePanelPage.textContent('h1').catch(() => 'N/A');
    console.log('  Title:', title);
    console.log('  Heading:', heading);
  } else {
    console.log('\n⚠ Could not detect extension ID from service workers');
    console.log('  Trying to find extension via chrome://extensions...');

    // Navigate to chrome://extensions to get the ID
    const extPage = await context.newPage();
    await extPage.goto('chrome://extensions');
    await new Promise(r => setTimeout(r, 1000));
    await extPage.screenshot({ path: 'chrome-extensions.png' });
    console.log('✓ Screenshot of chrome://extensions saved');
  }

  // Open a page with images to test context menu
  const page = await context.newPage();
  await page.goto('https://picsum.photos/');
  await page.waitForLoadState('networkidle');
  console.log('\n✓ Opened test page with images');

  // Take a screenshot of the page
  await page.screenshot({ path: 'test-page.png' });
  console.log('✓ Screenshot saved: test-page.png');

  console.log('\n📋 Manual testing instructions:');
  console.log('1. Right-click on an image to see "Send to Pageant Scout" option');
  console.log('2. Click the extension icon (puzzle piece) in toolbar');
  console.log('3. Pin the extension and click it to open side panel');
  console.log('\n🎯 Browser will stay open for 10 minutes. Press Ctrl+C to exit early.');

  await new Promise(r => setTimeout(r, 600000)); // 10 minutes

  await context.close();
  console.log('\n✓ Test complete');
}

testExtensionLoading().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
