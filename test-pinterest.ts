/**
 * Test Pageant Scout hover button on Pinterest search grid
 */

import { chromium } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, 'extension');

async function testPinterest() {
  console.log('🚀 Testing hover button on Pinterest search grid...\n');

  const userDataDir = '/tmp/playwright-pinterest-test-' + Date.now();

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

  const page = await context.newPage();

  // Go directly to a search page with image grid
  console.log('Navigating to Pinterest search...');
  await page.goto('https://www.pinterest.com/search/pins/?q=landscape%20photography', { timeout: 60000 });
  console.log('✓ Page loaded\n');

  // Wait for page to render and content script to load
  await new Promise(r => setTimeout(r, 4000));

  // Try to close Pinterest's signup modal if present
  const modalClosed = await page.evaluate(() => {
    // Find and click the close button on the signup modal
    const closeBtn = document.querySelector('[aria-label="close"]') ||
                     document.querySelector('[data-test-id="fullPageSignupModal"] button[aria-label]') ||
                     document.querySelector('button[aria-label="Cerrar"]');
    if (closeBtn) {
      (closeBtn as HTMLElement).click();
      return 'clicked close button';
    }

    // Try pressing escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));

    // Remove modal entirely if can't close
    const modal = document.querySelector('[data-test-id="fullPageSignupModal"]');
    if (modal) {
      modal.remove();
      return 'removed modal';
    }

    return 'no modal found';
  });
  console.log('Modal handling:', modalClosed);

  await new Promise(r => setTimeout(r, 1000));

  // Check if content script loaded
  const contentScriptLoaded = await page.evaluate(() => {
    return !!window.__pageantScoutLoaded;
  });
  console.log('Content script loaded:', contentScriptLoaded);

  // Check if button element exists
  const buttonExists = await page.evaluate(() => {
    return !!document.getElementById('pageant-scout-btn');
  });
  console.log('Pageant button element exists:', buttonExists);

  // Take initial screenshot
  await page.screenshot({ path: 'pinterest-search.png' });
  console.log('✓ Search page screenshot saved\n');

  // Get all images using page.$$
  const allImages = await page.$$('img');
  console.log(`Found ${allImages.length} total img elements\n`);

  // Filter to visible, large images
  const imageData = [];
  for (let i = 0; i < Math.min(allImages.length, 30); i++) {
    const img = allImages[i];
    const box = await img.boundingBox();
    if (box && box.width >= 60 && box.height >= 60) {
      const info = await img.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          src: el.src?.substring(0, 60),
          inViewport: rect.top >= 0 && rect.top < window.innerHeight,
          parentChain: (() => {
            let p = el.parentElement;
            const chain = [];
            for (let j = 0; j < 4 && p; j++) {
              chain.push(p.tagName + (p.className ? '.' + p.className.toString().split(' ')[0] : ''));
              p = p.parentElement;
            }
            return chain.join(' > ');
          })(),
        };
      });
      imageData.push({ index: i, handle: img, box, ...info });
    }
  }

  console.log(`Found ${imageData.length} large visible images\n`);

  // Test hovering over images in viewport
  const inViewport = imageData.filter(d => d.inViewport);
  console.log(`Testing ${Math.min(inViewport.length, 8)} images in viewport:\n`);

  let successCount = 0;
  let failCount = 0;

  for (const imgData of inViewport.slice(0, 8)) {
    console.log(`[Image ${imgData.index}] ${Math.round(imgData.box.width)}x${Math.round(imgData.box.height)}`);
    console.log(`  Parent chain: ${imgData.parentChain}`);

    // Hover over the image
    try {
      await imgData.handle.hover({ timeout: 5000 });
    } catch (e) {
      console.log(`  ⚠ Could not hover (modal blocking?)`);
      continue;
    }
    await new Promise(r => setTimeout(r, 400));

    // Check if button appeared
    const buttonState = await page.evaluate(() => {
      const btn = document.getElementById('pageant-scout-btn');
      if (!btn) return { exists: false };
      const style = window.getComputedStyle(btn);
      return {
        exists: true,
        display: btn.style.display,
        computedDisplay: style.display,
        visible: btn.style.display === 'flex',
        position: { left: btn.style.left, top: btn.style.top },
      };
    });

    if (buttonState.visible) {
      console.log(`  ✅ APPEARED at (${buttonState.position.left}, ${buttonState.position.top})`);
      successCount++;
    } else {
      console.log(`  ❌ NOT visible (display: ${buttonState.display})`);
      failCount++;

      // Debug: what's at image center?
      const debug = await imgData.handle.evaluate((img) => {
        const rect = img.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const elAtPoint = document.elementFromPoint(cx, cy);

        // Check what findMediaElement would return
        let el = elAtPoint;
        const walkUp = [];
        for (let i = 0; i < 8 && el; i++) {
          const tag = el.tagName;
          const isMedia = tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS';
          walkUp.push({ tag, isMedia });
          if (isMedia) break;
          el = el.parentElement;
        }

        return {
          elementAtCenter: elAtPoint?.tagName,
          isImg: elAtPoint === img,
          walkUp,
        };
      });
      console.log(`  Debug: center element is ${debug.elementAtCenter}, isImg=${debug.isImg}`);
      console.log(`  Walk up: ${debug.walkUp.map(w => w.tag + (w.isMedia ? '✓' : '')).join(' → ')}`);
    }
    console.log('');
  }

  console.log(`\n📊 Results: ${successCount} success, ${failCount} fail\n`);

  // Take final screenshot with hover
  if (inViewport.length > 0) {
    await inViewport[0].handle.hover();
    await new Promise(r => setTimeout(r, 300));
  }
  await page.screenshot({ path: 'pinterest-hover-test.png' });
  console.log('✓ Final screenshot saved: pinterest-hover-test.png');

  console.log('\n🎯 Browser will stay open for 30 seconds. Press Ctrl+C to exit early.');
  await new Promise(r => setTimeout(r, 30000));

  await context.close();
}

testPinterest().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
