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
  reportsResponsive: [],
  reportsClosure: [],
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

const reportsResponsiveViewports = [
  ['reports-phone-390', 390, 844],
  ['reports-landscape-844', 844, 390],
  ['reports-tablet-768', 768, 1024],
  ['reports-desktop-1440', 1440, 1000],
  ['reports-2xl-2560', 2560, 1440],
];

const reportsModes = ['overview', 'analytics', 'trading', 'allocation', 'monthly'];

async function reportsViewportMetrics(page) {
  return page.evaluate(() => {
    const rail = document.querySelector('[data-reports-navigation] [role="tablist"]');
    const stage = document.querySelector('.premium-reports-mode-stage');
    const tabs = rail ? [...rail.querySelectorAll('[role="tab"]')] : [];
    const tabTops = tabs.map((tab) => Math.round(tab.getBoundingClientRect().top));
    const uniqueRows = new Set(tabTops).size;

    const documentClientWidth = document.documentElement.clientWidth;
    const documentScrollWidth = document.documentElement.scrollWidth;
    const bodyClientWidth = document.body.clientWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const pageOverflow = Math.max(
      documentScrollWidth - documentClientWidth,
      bodyScrollWidth - bodyClientWidth,
    );

    const stageRect = stage?.getBoundingClientRect() ?? null;
    const stageOverflow =
      stageRect == null
        ? null
        : Math.max(0, -stageRect.left, stageRect.right - window.innerWidth);

    return {
      pageOverflow,
      railClientWidth: rail?.clientWidth ?? null,
      railScrollWidth: rail?.scrollWidth ?? null,
      railRows: uniqueRows,
      stageLeft: stageRect?.left ?? null,
      stageRight: stageRect?.right ?? null,
      stageOverflow,
    };
  });
}

for (const [name, width, height] of reportsResponsiveViewports) {
  const { context, page } = await openStablePage(width, height);
  try {
    await page.locator('#tab-reports').click();
    await page.locator('[data-reports-navigation]').waitFor({ state: 'visible' });
    await page.waitForTimeout(160);

    const overviewMetrics = await reportsViewportMetrics(page);
    report.reportsResponsive.push({
      name,
      width,
      height,
      mode: 'overview',
      expanded: false,
      ...overviewMetrics,
    });

    if (overviewMetrics.pageOverflow > 1 || (overviewMetrics.stageOverflow ?? 0) > 1) {
      report.errors.push(
        `${name}/overview: Reports workspace overflow page=${overviewMetrics.pageOverflow}px stage=${overviewMetrics.stageOverflow ?? 'missing'}px`,
      );
    }
    if (overviewMetrics.railRows !== 1) {
      report.errors.push(`${name}: Reports mode rail wrapped to ${overviewMetrics.railRows} rows`);
    }

    const inspectButton = page.getByRole('button', { name: 'Inspect' }).first();
    await inspectButton.click();
    await page.waitForTimeout(120);
    const expandedMetrics = await reportsViewportMetrics(page);
    report.reportsResponsive.push({
      name,
      width,
      height,
      mode: 'overview',
      expanded: true,
      ...expandedMetrics,
    });
    if (expandedMetrics.pageOverflow > 1 || (expandedMetrics.stageOverflow ?? 0) > 1) {
      report.errors.push(
        `${name}/overview-expanded: Reports workspace overflow page=${expandedMetrics.pageOverflow}px stage=${expandedMetrics.stageOverflow ?? 'missing'}px`,
      );
    }

    for (const mode of reportsModes.slice(1)) {
      await page.locator(`#reports-mode-${mode}`).click();
      await page.locator(`[data-reports-workspace="${mode}"]`).waitFor({ state: 'visible' });
      await page.waitForTimeout(160);
      const metrics = await reportsViewportMetrics(page);
      report.reportsResponsive.push({
        name,
        width,
        height,
        mode,
        expanded: false,
        ...metrics,
      });
      if (metrics.pageOverflow > 1 || (metrics.stageOverflow ?? 0) > 1) {
        report.errors.push(
          `${name}/${mode}: Reports workspace overflow page=${metrics.pageOverflow}px stage=${metrics.stageOverflow ?? 'missing'}px`,
        );
      }
      if (metrics.railRows !== 1) {
        report.errors.push(`${name}/${mode}: Reports mode rail wrapped to ${metrics.railRows} rows`);
      }
    }
  } catch (error) {
    report.errors.push(
      `${name}: Reports responsive validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await context.close();
  }
}


async function assertAriaState(locator, attribute, label) {
  const value = await locator.getAttribute(attribute);
  if (value !== 'true') {
    throw new Error(`${label}: expected ${attribute}="true", received ${String(value)}`);
  }
}

async function recordReportsClosure(reportEntry) {
  report.reportsClosure.push(reportEntry);
}

{
  const { context, page } = await openStablePage(1440, 1000);
  try {
    await page.locator('#tab-reports').click();
    await page.locator('[data-reports-workspace="overview"]').waitFor({ state: 'visible' });

    for (const label of [
      'Current portfolio snapshot',
      'Trading Quality',
      'Risk & Costs',
      'Concentration',
      'Current Month',
    ]) {
      await page.getByText(label, { exact: true }).first().waitFor({ state: 'visible' });
    }
    await recordReportsClosure({ check: 'overview-diagnostics', status: 'passed' });

    const tradingPreview = page.locator(
      'section[aria-labelledby="reports-overview-trading-quality"]',
    );
    await tradingPreview.getByRole('button', { name: 'Inspect' }).click();
    await tradingPreview
      .getByRole('button', { name: 'Open full trading report' })
      .click();
    await page.locator('[data-reports-workspace="trading"]').waitFor({ state: 'visible' });

    const directlyPersistedMode = await page.evaluate(
      () => window.localStorage.getItem('reports:lastMode'),
    );
    if (directlyPersistedMode !== 'trading') {
      throw new Error(
        `Direct report opening did not persist trading mode: ${String(directlyPersistedMode)}`,
      );
    }
    await recordReportsClosure({ check: 'direct-mode-opening', status: 'passed' });

    await page.locator('#tab-overview').click();
    await page.locator('#tab-reports').click();
    await page.locator('[data-reports-workspace="trading"]').waitFor({ state: 'visible' });
    await recordReportsClosure({ check: 'navigation-restoration', status: 'passed' });

    await page.locator('#reports-mode-analytics').click();
    const analyticsWorkspace = page.locator('[data-reports-workspace="analytics"]');
    await analyticsWorkspace.waitFor({ state: 'visible' });

    // Scope controls to the active Reports Analytics workspace. The same
    // analytics component may exist elsewhere in the deterministic app shell.
    const analyticsTimeframe = analyticsWorkspace.getByRole('group', { name: 'Analytics timeframe' });
    const oneWeek = analyticsTimeframe.getByRole('button', { name: '1W', exact: true });
    await oneWeek.click();
    await page.waitForTimeout(120);
    await assertAriaState(oneWeek, 'aria-pressed', 'Analytics 1W');

    const today = analyticsTimeframe.getByRole('button', { name: 'Today', exact: true });
    await today.click();
    await page.waitForTimeout(120);
    await assertAriaState(today, 'aria-pressed', 'Analytics Today');

    const todayResolution = analyticsWorkspace.getByRole('group', { name: 'Today chart resolution' });
    await todayResolution.waitFor({ state: 'visible' });
    const fiveMinute = todayResolution.getByRole('button', { name: '5m', exact: true });
    await fiveMinute.click();
    await page.waitForTimeout(80);
    await assertAriaState(fiveMinute, 'aria-pressed', 'Today 5m resolution');

    const modeTrigger = analyticsWorkspace.locator('button[aria-haspopup="menu"]').first();
    await modeTrigger.click();
    const twrOption = page.getByRole('menuitemradio', { name: /Performance \(TWR\)/ });
    await twrOption.click();
    await page.waitForTimeout(80);
    if (!(await modeTrigger.textContent())?.includes('Performance (TWR)')) {
      throw new Error('Analytics mode menu did not switch to Performance (TWR)');
    }

    const tradeByTrade = analyticsWorkspace.getByRole('button', {
      name: 'Trade-by-Trade',
      exact: true,
    });
    await tradeByTrade.click();
    await assertAriaState(tradeByTrade, 'aria-pressed', 'Trade-by-Trade trajectory');

    const trajectoryTimeframe = analyticsWorkspace.getByRole('group', {
      name: 'Realized trajectory timeframe',
    });
    const trajectoryOneMonth = trajectoryTimeframe.getByRole('button', {
      name: '1M',
      exact: true,
    });
    await trajectoryOneMonth.click();
    await assertAriaState(
      trajectoryOneMonth,
      'aria-pressed',
      'Realized trajectory 1M',
    );
    await recordReportsClosure({ check: 'analytics-controls', status: 'passed' });

    await page.locator('#reports-mode-trading').click();
    const tradingWorkspace = page.locator('[data-reports-workspace="trading"]');
    await tradingWorkspace.waitFor({ state: 'visible' });

    const trading90d = tradingWorkspace.getByRole('button', { name: '90D', exact: true });
    await trading90d.click();
    await assertAriaState(trading90d, 'aria-pressed', 'Trading 90D filter');

    const tradeTypeTrigger = tradingWorkspace.getByRole('button', {
      name: 'Filter by trade type',
    });
    await tradeTypeTrigger.click();
    await page.getByRole('option', { name: 'Swing Only', exact: true }).click();
    if (!(await tradeTypeTrigger.textContent())?.includes('Swing Only')) {
      throw new Error('Trading trade-type filter did not switch to Swing Only');
    }
    await tradingWorkspace
      .getByRole('button', { name: 'Export CSV', exact: true })
      .waitFor({ state: 'visible' });
    await tradingWorkspace
      .getByRole('button', { name: 'Print', exact: true })
      .waitFor({ state: 'visible' });
    await recordReportsClosure({ check: 'trading-filters-and-exports', status: 'passed' });

    await page.locator('#reports-mode-allocation').click();
    const allocationWorkspace = page.locator('[data-reports-workspace="allocation"]');
    await allocationWorkspace.waitFor({ state: 'visible' });

    const holdings = allocationWorkspace.getByRole('button', {
      name: 'Holdings',
      exact: true,
    });
    await holdings.click();
    await assertAriaState(holdings, 'aria-pressed', 'Allocation Holdings');

    const cashSwitch = allocationWorkspace.getByRole('switch', { name: /Include cash/i });
    const cashBefore = await cashSwitch.getAttribute('aria-checked');
    await cashSwitch.click();
    const cashAfter = await cashSwitch.getAttribute('aria-checked');
    if (cashBefore === cashAfter) {
      throw new Error('Allocation Include cash switch did not toggle');
    }
    await recordReportsClosure({ check: 'allocation-sectors-holdings-cash', status: 'passed' });

    await page.locator('#reports-mode-monthly').click();
    const monthlyWorkspace = page.locator('[data-reports-workspace="monthly"]');
    await monthlyWorkspace.waitFor({ state: 'visible' });

    await monthlyWorkspace
      .getByRole('button', { name: 'Export CSV', exact: true })
      .waitFor({ state: 'visible' });
    await monthlyWorkspace
      .getByRole('button', { name: 'Print', exact: true })
      .waitFor({ state: 'visible' });

    const monthlyFilter = monthlyWorkspace.getByRole('button', {
      name: 'Filter monthly report records',
    });
    await monthlyFilter.click();
    await page
      .getByRole('option', { name: 'Liquidated Trades Only', exact: true })
      .click();
    if (!(await monthlyFilter.textContent())?.includes('Liquidated Trades Only')) {
      throw new Error('Monthly filter did not switch to Liquidated Trades Only');
    }

    await monthlyFilter.click();
    await page
      .getByRole('option', { name: 'Month-End Holdings Only', exact: true })
      .click();
    if (!(await monthlyFilter.textContent())?.includes('Month-End Holdings Only')) {
      throw new Error('Monthly filter did not switch to Month-End Holdings Only');
    }

    const allMonths = monthlyWorkspace.getByRole('button', {
      name: /All Recorded Months/,
    });
    await allMonths.click();
    await assertAriaState(allMonths, 'aria-pressed', 'Monthly All Recorded Months');
    await recordReportsClosure({ check: 'monthly-filters-and-exports', status: 'passed' });
  } catch (error) {
    report.errors.push(
      `reports-closure-desktop: ${error instanceof Error ? error.message : String(error)}`,
    );
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

for (const item of report.comparisons) {
  if (item.status === 'failed') {
    const detail = item.reason
      ? item.reason
      : `diff=${((item.diffRatio ?? 0) * 100).toFixed(3)}% exceeds ${(maxDiffRatio * 100).toFixed(3)}%`;
    report.errors.push(`${item.name}: ${detail}`);
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
}
if (report.errors.length) {
  for (const error of report.errors) console.error(`[visual-error] ${error}`);
  process.exitCode = 1;
}
