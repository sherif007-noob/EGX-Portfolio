import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = process.cwd();
const BASE_URL = process.env.VISUAL_BASE_URL || 'http://127.0.0.1:4173';
const baselineDir = path.join(ROOT, 'visual-regression', 'baseline');
const currentDir = path.join(ROOT, 'visual-regression', 'current');
const diffDir = path.join(ROOT, 'visual-regression', 'diff');
const reportPath = path.join(ROOT, 'visual-regression', 'report.json');
const acceptedChangesPath = path.join(ROOT, 'visual-regression', 'accepted-changes.json');
const requireBaseline = process.env.VISUAL_REQUIRE_BASELINE === 'true';
const maxDiffRatio = Number(process.env.VISUAL_MAX_DIFF_RATIO || 0.01);
const channelTolerance = Number(process.env.VISUAL_CHANNEL_TOLERANCE || 16);
const fixedNowIso = '2026-09-30T09:00:00.000Z';

let acceptedChanges = {};
try {
  acceptedChanges = JSON.parse(await fs.readFile(acceptedChangesPath, 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

async function sha256File(file) {
  const contents = await fs.readFile(file);
  return crypto.createHash('sha256').update(contents).digest('hex');
}

await fs.rm(currentDir, { recursive: true, force: true });
await fs.rm(diffDir, { recursive: true, force: true });
await fs.mkdir(currentDir, { recursive: true });
await fs.mkdir(diffDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  generatedAt: new Date().toISOString(),
  fixedBrowserTime: fixedNowIso,
  baseUrl: BASE_URL,
  geometry: [],
  screenshots: [],
  comparisons: [],
  errors: [],
};

const geometryViewports = [
  ['phone-320', 320, 740],
  ['phone-359', 359, 780],
  ['phone-390', 390, 844],
  ['phone-430', 430, 932],
  ['phone-landscape', 844, 390],
  ['tablet-768', 768, 1024],
  ['laptop-1024', 1024, 900],
  ['desktop-1280', 1280, 900],
  ['desktop-1440', 1440, 1000],
  ['desktop-1600', 1600, 1000],
  ['desktop-1920', 1920, 1080],
  ['desktop-2560', 2560, 1440],
];

const screenshotStates = [
  { name: 'overview-phone-320', width: 320, height: 740 },
  { name: 'overview-phone-390', width: 390, height: 844 },
  { name: 'overview-landscape', width: 844, height: 390 },
  { name: 'overview-laptop', width: 1024, height: 900 },
  { name: 'overview-desktop', width: 1440, height: 1000 },
  { name: 'overview-2xl', width: 2560, height: 1440 },
  { name: 'positions-desktop', width: 1440, height: 1000, tab: '#tab-positions' },
  { name: 'positions-phone', width: 390, height: 844, tab: '#tab-positions' },
  { name: 'closed-cycles-desktop', width: 1440, height: 1000, tab: '#tab-closed-cycles' },
  { name: 'reports-desktop', width: 1440, height: 1000, tab: '#tab-reports' },
  { name: 'journal-desktop', width: 1440, height: 1000, tab: '#tab-transactions' },
  { name: 'cash-desktop', width: 1440, height: 1000, tab: '#tab-cash-ledger' },
  { name: 'add-trade-phone', width: 390, height: 844, action: 'add-trade' },
  { name: 'transaction-edit-desktop', width: 1440, height: 1000, action: 'transaction-edit' },
  { name: 'data-tools-dropdown-desktop', width: 1440, height: 1000, action: 'data-tools' },
  { name: 'semantic-summary-desktop', width: 1440, height: 1000, locator: '.premium-overview-support-grid' },
];

async function makeContext(width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'Africa/Cairo',
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });

  await context.addInitScript((fixedIso) => {
    const OriginalDate = Date;
    const fixed = new OriginalDate(fixedIso).valueOf();
    class FixedDate extends OriginalDate {
      constructor(...args) {
        super(...(args.length === 0 ? [fixed] : args));
      }
      static now() {
        return fixed;
      }
    }
    Object.setPrototypeOf(FixedDate, OriginalDate);
    globalThis.Date = FixedDate;
  }, fixedNowIso);

  return context;
}

async function openStablePage(width, height) {
  const context = await makeContext(width, height);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.locator('#tab-overview').waitFor({ state: 'visible' });
  await page.addStyleTag({
    content: `
      * { caret-color: transparent !important; }
      html { scroll-behavior: auto !important; }
    `,
  });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(120);

  if (pageErrors.length) {
    throw new Error(`Browser page error: ${pageErrors.join(' | ')}`);
  }

  return { context, page };
}

async function pageGeometry(page) {
  return page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
}

for (const [name, width, height] of geometryViewports) {
  const { context, page } = await openStablePage(width, height);
  try {
    const geometry = await pageGeometry(page);
    const overflow = Math.max(
      geometry.documentScrollWidth - geometry.documentClientWidth,
      geometry.bodyScrollWidth - geometry.bodyClientWidth,
    );
    report.geometry.push({ name, width, height, overflow, ...geometry });
    if (overflow > 1) {
      report.errors.push(`${name}: page-level horizontal overflow is ${overflow}px`);
    }
  } finally {
    await context.close();
  }
}

async function prepareState(page, state) {
  if (state.tab) {
    await page.locator(state.tab).click();
    await page.waitForTimeout(160);
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  if (state.action === 'add-trade') {
    await page.locator('#header-add-trade-btn').click();
    await page.getByRole('dialog', { name: 'Add trade' }).waitFor({ state: 'visible' });
  }

  if (state.action === 'transaction-edit') {
    await page.locator('#tab-transactions').click();
    await page.waitForTimeout(120);
    await page.locator('button[title="Edit Transaction Record"]').first().click();
    await page.getByRole('dialog', { name: 'Edit transaction' }).waitFor({ state: 'visible' });
  }

  if (state.action === 'data-tools') {
    await page.locator('#header-data-tools-btn').click();
    await page.locator('#header-data-tools-menu').waitFor({ state: 'visible' });
  }

  await page.waitForTimeout(120);
}

for (const state of screenshotStates) {
  const { context, page } = await openStablePage(state.width, state.height);
  try {
    await prepareState(page, state);
    const file = path.join(currentDir, `${state.name}.png`);
    if (state.locator) {
      await page.locator(state.locator).screenshot({
        path: file,
        animations: 'disabled',
        scale: 'css',
      });
    } else {
      await page.screenshot({
        path: file,
        fullPage: false,
        animations: 'disabled',
        scale: 'css',
      });
    }
    report.screenshots.push({
      name: state.name,
      width: state.width,
      height: state.height,
      file: path.relative(ROOT, file),
    });
  } catch (error) {
    report.errors.push(`${state.name}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close();
  }
}

async function comparePng(name, currentFile, baselineFile) {
  const current = await sharp(currentFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const baseline = await sharp(baselineFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  if (current.info.width !== baseline.info.width || current.info.height !== baseline.info.height) {
    return {
      name,
      status: 'failed',
      reason: `dimension mismatch current=${current.info.width}x${current.info.height} baseline=${baseline.info.width}x${baseline.info.height}`,
      diffRatio: 1,
    };
  }

  const pixelCount = current.info.width * current.info.height;
  let changedPixels = 0;
  const diff = Buffer.alloc(pixelCount * 4);

  for (let px = 0; px < pixelCount; px += 1) {
    const offset = px * 4;
    let maxDelta = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      maxDelta = Math.max(
        maxDelta,
        Math.abs(current.data[offset + channel] - baseline.data[offset + channel]),
      );
    }

    const changed = maxDelta > channelTolerance;
    if (changed) changedPixels += 1;
    diff[offset] = changed ? 255 : 12;
    diff[offset + 1] = changed ? 40 : 12;
    diff[offset + 2] = changed ? 40 : 12;
    diff[offset + 3] = changed ? 255 : 150;
  }

  const diffRatio = pixelCount > 0 ? changedPixels / pixelCount : 0;
  if (diffRatio > maxDiffRatio) {
    const diffFile = path.join(diffDir, `${name}.png`);
    await sharp(diff, {
      raw: {
        width: current.info.width,
        height: current.info.height,
        channels: 4,
      },
    }).png().toFile(diffFile);
    return { name, status: 'failed', diffRatio, diffFile: path.relative(ROOT, diffFile) };
  }

  return { name, status: 'passed', diffRatio };
}

for (const shot of report.screenshots) {
  const currentFile = path.join(ROOT, shot.file);
  const baselineFile = path.join(baselineDir, `${shot.name}.png`);
  try {
    await fs.access(baselineFile);
    const comparison = await comparePng(shot.name, currentFile, baselineFile);
    const accepted = acceptedChanges[shot.name];

    if (comparison.status === 'failed' && accepted?.sha256) {
      const currentSha256 = await sha256File(currentFile);
      if (currentSha256 === accepted.sha256) {
        report.comparisons.push({
          ...comparison,
          status: 'accepted-change',
          acceptedSha256: currentSha256,
          acceptanceReason: accepted.reason ?? null,
        });
        continue;
      }
    }

    report.comparisons.push(comparison);
  } catch {
    report.comparisons.push({ name: shot.name, status: 'missing-baseline', diffRatio: null });
    if (requireBaseline) report.errors.push(`${shot.name}: baseline is missing`);
  }
}

await browser.close();
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

for (const item of report.geometry) {
  console.log(
    `[geometry] ${item.name} ${item.width}x${item.height} overflow=${item.overflow}px scrollHeight=${item.scrollHeight}`,
  );
}
for (const item of report.comparisons) {
  console.log(
    `[visual] ${item.name}: ${item.status}${typeof item.diffRatio === 'number' ? ` diff=${(item.diffRatio * 100).toFixed(3)}%` : ''}`,
  );

  if (item.status === 'failed') {
    const detail = item.reason
      ? item.reason
      : `diff=${((item.diffRatio ?? 0) * 100).toFixed(3)}% exceeds ${(maxDiffRatio * 100).toFixed(3)}%`;
    report.errors.push(`${item.name}: ${detail}`);
  }
}
if (report.errors.length) {
  for (const error of report.errors) console.error(`[visual-error] ${error}`);
  process.exitCode = 1;
}
