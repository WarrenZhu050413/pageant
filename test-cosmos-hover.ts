/**
 * Test Pageant Scout hover button on cosmos.so grid
 */

import { chromium } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, 'extension');

async function testCosmosHover() {
  console.log('🚀 Testing hover button on cosmos.so grid...\n');

  const userDataDir = '/tmp/playwright-cosmos-test-' + Date.now();

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    timeout: 30000,
  });

  console.log('✓ Browser launched with extension\n');

  // Wait for extension to load
  await new Promise(r => setTimeout(r, 2000));

  // Navigate to cosmos.so discover page
  const page = await context.newPage();
  console.log('Navigating to cosmos.so...');
  await page.goto('https://www.cosmos.so/discover', { timeout: 60000 });
  console.log('✓ Page loaded, waiting for content...');

  // Wait for the page to fully render
  await page.waitForSelector('h2:has-text("Elements")', { timeout: 30000 }).catch(() => console.log('Could not find Elements heading'));
  console.log('✓ Elements section found\n');

  // Wait longer for content script to initialize
  await new Promise(r => setTimeout(r, 3000));

  // Check if content script loaded
  const contentScriptLoaded = await page.evaluate(() => {
    return !!window.__pageantScoutLoaded;
  });
  console.log('Content script loaded:', contentScriptLoaded);

  // If not loaded, check for console errors
  if (!contentScriptLoaded) {
    console.log('⚠ Content script not loaded - checking service worker...');
    const workers = context.serviceWorkers();
    console.log('Service workers:', workers.length);
    for (const w of workers) {
      console.log('  -', w.url());
    }
  }

  // Scroll down to the Elements grid section
  await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.includes('Elements'));
    if (heading) heading.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise(r => setTimeout(r, 1000));

  // Find a grid button and hover over it - use a more flexible selector
  const gridButtons = await page.$$('button');
  console.log(`Found ${gridButtons.length} grid buttons\n`);

  if (gridButtons.length > 0) {
    // Hover over the first grid button
    const btn = gridButtons[0];
    await btn.hover();
    console.log('✓ Hovered over first grid button');

    // Wait a moment for hover to register
    await new Promise(r => setTimeout(r, 300));

    // Check if Pageant Scout button appeared
    const pageantBtnVisible = await page.evaluate(() => {
      const btn = document.getElementById('pageant-scout-btn');
      return btn ? btn.style.display : 'not found';
    });
    console.log('Pageant Scout button display:', pageantBtnVisible);

    // Take screenshot
    await page.screenshot({ path: 'cosmos-hover-test.png', fullPage: false });
    console.log('✓ Screenshot saved: cosmos-hover-test.png\n');

    if (pageantBtnVisible === 'flex') {
      console.log('✅ SUCCESS: Hover button appears on cosmos.so grid!');
    } else {
      console.log('❌ FAIL: Hover button did NOT appear');

      // Debug: check what element is at the button's position
      const debugInfo = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const b of buttons) {
          if (b.textContent?.includes('Go to element')) {
            const rect = b.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtPoint = document.elementFromPoint(centerX, centerY);

            // Check parent's descendants for images
            let parent = b.parentElement;
            let foundImg = null;
            for (let i = 0; i < 3 && parent; i++) {
              const img = parent.querySelector('img');
              if (img) {
                const imgRect = img.getBoundingClientRect();
                if (imgRect.width >= 60 && imgRect.height >= 60) {
                  foundImg = { src: img.src.substring(0, 50), w: imgRect.width, h: imgRect.height };
                  break;
                }
              }
              parent = parent.parentElement;
            }

            return {
              buttonTag: b.tagName,
              elementAtCenter: elementAtPoint?.tagName,
              foundImgInSiblings: foundImg
            };
          }
        }
        return null;
      });
      console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
    }
  }

  console.log('\n🎯 Browser will stay open for 2 minutes. Press Ctrl+C to exit early.');
  await new Promise(r => setTimeout(r, 120000));

  await context.close();
}

testCosmosHover().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
