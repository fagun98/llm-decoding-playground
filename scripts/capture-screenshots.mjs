import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.PLAYGROUND_URL || 'http://127.0.0.1:4173/llm-decoding-playground/';
const OUT = path.resolve('assets');

async function waitForModel(page, timeoutMs = 300000) {
  await page.waitForFunction(
    () => {
      const overlay = document.querySelector('.loading-overlay');
      const bars = document.querySelectorAll('.chart-bar');
      const errorHeading = [...document.querySelectorAll('.explainer h3')].find(
        (el) => el.textContent === 'Error'
      );
      if (errorHeading) return 'error';
      if (!overlay && bars.length > 0) return 'ready';
      return false;
    },
    { timeout: timeoutMs }
  );

  const state = await page.evaluate(() => {
    const errorHeading = [...document.querySelectorAll('.explainer h3')].find(
      (el) => el.textContent === 'Error'
    );
    if (errorHeading) {
      return {
        ok: false,
        message: errorHeading.parentElement?.querySelector('p')?.textContent || 'unknown'
      };
    }
    return { ok: true, bars: document.querySelectorAll('.chart-bar').length };
  });

  if (!state.ok) throw new Error(`Model failed: ${state.message}`);
  console.log(`Model ready with ${state.bars} probability bars`);
}

async function setSlider(page, labelText, value) {
  const group = page.locator('.control-group').filter({ hasText: labelText });
  const slider = group.locator('input[type="range"]');
  await slider.waitFor();

  await slider.evaluate((el, v) => {
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    proto?.set?.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

  await page.waitForFunction(
    ({ label, expected }) => {
      const groups = [...document.querySelectorAll('.control-group')];
      const group = groups.find((g) => g.textContent?.includes(label));
      const shown = group?.querySelector('.control-value')?.textContent?.trim();
      if (!shown) return false;
      if (label === 'Top-K' && expected === 0) return shown === 'Off';
      if (label === 'Top-K') return shown === String(expected);
      const num = Number(shown);
      return Math.abs(num - expected) < 0.011;
    },
    { label: labelText, expected: value }
  );

  // Let probability chart recompute
  await page.waitForTimeout(1200);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[browser error]`, msg.text());
  });
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  console.log('Opening', BASE);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  console.log('Waiting for model load...');
  await waitForModel(page);

  // Main screenshot with clear filtering
  await setSlider(page, 'Temperature', 1.0);
  await setSlider(page, 'Top-K', 10);
  await setSlider(page, 'Top-P', 0.55);

  await page.waitForFunction(() => document.querySelectorAll('.bar-label.filtered').length > 0, {
    timeout: 15000
  });

  const filteredBefore = await page.locator('.bar-label.filtered').count();
  console.log('Filtered labels visible:', filteredBefore);

  await page.screenshot({
    path: path.join(OUT, 'screenshot-main.png'),
    fullPage: true
  });
  console.log('Saved screenshot-main.png');

  const chart = page.locator('.probability-chart');
  await chart.scrollIntoViewIfNeeded();
  await chart.screenshot({ path: path.join(OUT, 'screenshot-filtered.png') });
  console.log('Saved screenshot-filtered.png');

  // Strategy comparison
  await page.getByRole('button', { name: 'Compare Strategies' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.comparison-item').length >= 3, {
    timeout: 300000
  });
  await page.waitForTimeout(800);
  const comparison = page.locator('.card').filter({ hasText: 'Strategy Comparison' });
  await comparison.scrollIntoViewIfNeeded();
  await comparison.screenshot({ path: path.join(OUT, 'screenshot-comparison.png') });
  console.log('Saved screenshot-comparison.png');

  const summary = {
    filteredCount: await page.locator('.bar-label.filtered').count(),
    comparisonCount: await page.locator('.comparison-item').count(),
    topK: await page.locator('.control-group').filter({ hasText: 'Top-K' }).locator('.control-value').innerText(),
    topP: await page.locator('.control-group').filter({ hasText: 'Top-P' }).locator('.control-value').innerText()
  };
  console.log(JSON.stringify(summary, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
