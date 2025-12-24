/**
 * Test Pageant Scout hover button on Pinterest pin detail page
 */

import { chromium } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, 'extension');

async function testPinterestDetail() {
  console.log('🚀 Testing hover button on Pinterest pin detail page...\n');

  const userDataDir = '/tmp/playwright-pinterest-detail-' + Date.now();

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
  await new Promise(r => setTimeout(r, 2000));

  const page = await context.newPage();

  // Go to search first
  console.log('Navigating to Pinterest search...');
  await page.goto('https://www.pinterest.com/search/pins/?q=landscape', { timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Remove modal
  await page.evaluate(() => {
    const modal = document.querySelector('[data-test-id="fullPageSignupModal"]');
    if (modal) modal.remove();
  });
  await new Promise(r => setTimeout(r, 500));

  // Click on first pin to open detail view
  console.log('Clicking on first pin to open detail view...');
  const firstPin = await page.$('[data-test-id="pin"]');
  if (firstPin) {
    await firstPin.click();
    await new Promise(r => setTimeout(r, 3000));
  } else {
    // Fallback: click on first image
    const firstImg = await page.$('img[src*="pinimg.com"]');
    if (firstImg) {
      await firstImg.click();
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Remove any new modal that appeared
  await page.evaluate(() => {
    const modal = document.querySelector('[data-test-id="fullPageSignupModal"]');
    if (modal) modal.remove();
    const modal2 = document.querySelector('[role="dialog"]');
    if (modal2 && modal2.textContent?.includes('sesión')) modal2.remove();
  });
  await new Promise(r => setTimeout(r, 1000));

  console.log('Current URL:', page.url());

  // Take screenshot
  await page.screenshot({ path: 'pinterest-detail-initial.png' });
  console.log('✓ Detail page screenshot saved\n');

  // Check if this is a pin detail page
  const pageInfo = await page.evaluate(() => {
    return {
      url: window.location.href,
      isDetailPage: window.location.pathname.includes('/pin/'),
      pageantButtonExists: !!document.getElementById('pageant-scout-btn'),
    };
  });
  console.log('Page info:', pageInfo);

  // Find the main pin image
  const mainImages = await page.$$('img');
  console.log(`Found ${mainImages.length} images\n`);

  // Get info about large images
  const imageData = [];
  for (const img of mainImages) {
    const box = await img.boundingBox();
    if (box && box.width >= 200 && box.height >= 200) {
      const info = await img.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          src: el.src?.substring(0, 80),
          width: rect.width,
          height: rect.height,
          inViewport: rect.top >= 0 && rect.bottom < window.innerHeight,
          alt: el.alt,
        };
      });
      imageData.push({ handle: img, box, ...info });
    }
  }

  console.log(`Found ${imageData.length} large images (>200x200):\n`);

  for (const imgData of imageData) {
    console.log(`[${Math.round(imgData.width)}x${Math.round(imgData.height)}] ${imgData.src?.substring(0, 50)}...`);

    try {
      await imgData.handle.hover({ timeout: 5000 });
    } catch (e) {
      console.log('  ⚠ Could not hover');
      continue;
    }
    await new Promise(r => setTimeout(r, 500));

    const buttonState = await page.evaluate(() => {
      const btn = document.getElementById('pageant-scout-btn');
      if (!btn) return { exists: false };
      return {
        exists: true,
        visible: btn.style.display === 'flex',
        position: { left: btn.style.left, top: btn.style.top },
      };
    });

    if (buttonState.visible) {
      console.log(`  ✅ APPEARED at (${buttonState.position.left}, ${buttonState.position.top})`);
    } else {
      console.log(`  ❌ NOT visible`);

      // Debug what's at the image center
      const debug = await imgData.handle.evaluate((img) => {
        const rect = img.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const elAtPoint = document.elementFromPoint(cx, cy);

        // Walk up to find what's capturing events
        let el = elAtPoint;
        const chain = [];
        for (let i = 0; i < 6 && el; i++) {
          chain.push({
            tag: el.tagName,
            classes: el.className?.toString()?.split(' ')[0] || '',
            role: el.getAttribute('role') || '',
          });
          el = el.parentElement;
        }

        return {
          elementAtCenter: elAtPoint?.tagName,
          isImg: elAtPoint === img,
          chain,
        };
      });
      console.log(`  Element at center: ${debug.elementAtCenter} (isImg: ${debug.isImg})`);
      console.log(`  Chain: ${debug.chain.map(c => c.tag + (c.classes ? '.' + c.classes : '')).join(' > ')}`);
    }
    console.log('');
  }

  // Take final screenshot while hovering
  if (imageData.length > 0) {
    await imageData[0].handle.hover({ timeout: 5000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 300));
  }
  await page.screenshot({ path: 'pinterest-detail-hover.png' });
  console.log('✓ Final screenshot saved\n');

  console.log('🎯 Browser will stay open for 30 seconds.');
  await new Promise(r => setTimeout(r, 30000));

  await context.close();
}

testPinterestDetail().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
