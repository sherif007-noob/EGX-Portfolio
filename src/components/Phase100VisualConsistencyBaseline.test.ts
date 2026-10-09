import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 10.0 visual consistency baseline freeze', () => {
  it('routes the main destinations to native medium UI owners', () => {
    const app = readRelative('../App.tsx');
    const expected = [
      ['overview', 'HomeScreen'], ['positions', 'SimpleHoldings'],
      ['closed_cycles', 'SimpleClosedView'], ['reports', 'SimpleReportsView'],
      ['journal', 'SimpleTransactionsView'], ['cash', 'SimpleCashView'],
      ['directory', 'TickerDirectoryView'],
    ];
    for (const [tab, owner] of expected) {
      const start = app.indexOf(`{activeTab === '${tab}'`);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(app.slice(start, start + 1800)).toContain(`<${owner}`);
    }
  });

  it('freezes the canonical H0-H5 hierarchy and action-priority vocabulary', () => {
    const hierarchy = readRelative('./VisualHierarchy.tsx');

    for (const level of ['h0', 'h1', 'h2', 'h3', 'h4', 'h5']) {
      expect(hierarchy).toContain(`${level}: 'premium-hierarchy-${level}'`);
    }

    for (const role of ['primary', 'secondary', 'utility', 'destructive']) {
      expect(hierarchy).toContain(`${role}: 'premium-action-priority-${role}'`);
    }

    for (const role of [
      "'page-title'",
      "'section-title'",
      'metric:',
      "'metric-label'",
      'metadata:',
      'helper:',
    ]) {
      expect(hierarchy).toContain(role);
    }
  });

  it('protects the Phase 8 material/semantic/dropdown reference contract', () => {
    const contract = readRelative('../../docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md');

    expect(contract).toContain('CANONICAL — HIERARCHY / MATERIAL SEPARATION');
    expect(contract).toContain('## Additive semantic edge rule');
    expect(contract).toContain('## Canonical dropdown surface');
    expect(contract).toContain('## Monthly Report material reference');
    expect(contract).toContain('Hierarchy classes must never redefine material');
    expect(contract).toContain('edge must never replace the halo');
  });

  it('protects the Phase 9 source-frozen global command architecture', () => {
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');
    const closure = readRelative('./Phase99HeaderClosure.test.ts');

    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');
    expect(closure).toContain("describe('Phase 9.9 header regression and closure'");
    expect(closure).toContain('freezes the final information architecture and every global command');
    expect(closure).toContain('freezes viewport architecture from phone through 2XL');
  });

  it('documents audit-before-change and no-redesign rules for Phase 10', () => {
    const plan = readRelative('../../docs/PHASE10_VISUAL_CONSISTENCY_PLAN.md');

    expect(plan).toContain('# Phase 10 — Full-App Visual Consistency & System Closure');
    expect(plan).toContain('The purpose of Phase 10 is **consistency, not redesign**.');
    expect(plan).toContain('Audit before implementation');
    expect(plan).toContain('A source difference is an audit candidate, not automatically a defect');
    expect(plan).toContain('Phase 9 header/navigation is frozen');
    expect(plan).toContain('No giant Phase 10 implementation commit');
  });
});
