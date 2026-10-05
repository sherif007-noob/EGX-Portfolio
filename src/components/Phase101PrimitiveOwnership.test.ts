import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 10.1 primitive and token ownership', () => {
  it('defines one React-side registry for canonical shared primitive class names', () => {
    const primitives = readRelative('./VisualPrimitives.ts');

    for (const className of [
      'premium-action',
      'premium-control',
      'premium-field',
      'premium-icon-action',
      'premium-selector-shell',
      'premium-select-trigger',
      'premium-floating',
      'premium-dropdown',
      'premium-menu-item',
      'premium-inset-glass',
      'premium-panel',
      'premium-subpanel',
      'premium-table-shell',
      'premium-modal',
      'premium-modal-section',
    ]) {
      expect(primitives).toContain(className);
    }
  });

  it('routes shared select/date/number controls through the primitive registry', () => {
    for (const file of [
      './AnalyticsSelect.tsx',
      './DateInput.tsx',
      './NumberStepperInput.tsx',
    ]) {
      const source = readRelative(file);
      expect(source).toContain("import { PREMIUM_PRIMITIVE_CLASS } from './VisualPrimitives'");
      expect(source).toContain('PREMIUM_PRIMITIVE_CLASS.');
    }

    const select = readRelative('./AnalyticsSelect.tsx');
    expect(select).toContain('PREMIUM_PRIMITIVE_CLASS.control');
    expect(select).toContain('PREMIUM_PRIMITIVE_CLASS.selectTrigger');
    expect(select).toContain('PREMIUM_PRIMITIVE_CLASS.dropdownSurface');
    expect(select).toContain('PREMIUM_PRIMITIVE_CLASS.menuItem');

    const date = readRelative('./DateInput.tsx');
    expect(date).toContain('PREMIUM_PRIMITIVE_CLASS.field');
    expect(date).toContain('PREMIUM_PRIMITIVE_CLASS.iconAction');

    const stepper = readRelative('./NumberStepperInput.tsx');
    expect(stepper).toContain('PREMIUM_PRIMITIVE_CLASS.field');
    expect(stepper).toContain('PREMIUM_PRIMITIVE_CLASS.control');
    expect(stepper).toContain('PREMIUM_PRIMITIVE_CLASS.insetGlass');
  });

  it('keeps semantic financial state out of the structural primitive registry', () => {
    const primitives = readRelative('./VisualPrimitives.ts');

    expect(primitives).not.toContain('premium-glow-win');
    expect(primitives).not.toContain('premium-glow-loss');
    expect(primitives).not.toContain('premium-glow-buy');
    expect(primitives).not.toContain('premium-state-win');
    expect(primitives).not.toContain('premium-state-loss');
    expect(primitives).not.toContain('premium-state-buy');
    expect(primitives).not.toContain('premium-semantic-edge');
  });

  it('gives canonical motion durations a single global token owner', () => {
    const legacy = readRelative('../index.css');
    const tokens = readRelative('../styles/tokens.css');
    const motion = readRelative('../styles/motion.css');

    for (const token of [
      '--motion-instant:',
      '--motion-fast:',
      '--motion-control:',
      '--motion-popover:',
      '--motion-panel:',
      '--motion-modal:',
    ]) {
      expect(tokens.split(token).length - 1).toBe(1);
      expect(legacy).not.toContain(token);
    }

    expect(motion).toContain('/* Phase 4.1 — perceptible motion correction');
    expect(tokens).toContain('--motion-instant: 120ms');
    expect(tokens).toContain('--motion-modal: 360ms');
    expect(tokens).toContain('Canonical motion durations are owned by the');
  });

  it('treats responsive hierarchy token overrides as intentional rather than duplicate ownership', () => {
    const hierarchy = readRelative('../styles/hierarchy.css');
    const responsive = readRelative('../styles/responsive.css');

    expect(hierarchy).toContain('/* Pass 8.4.4 — canonical spacing rhythm.');
    expect(responsive).toContain('@media (max-width: 767px)');
    expect(responsive).toContain('/* Pass 8.6 — narrow-phone hierarchy guard.');
    expect(responsive).toContain('@media (max-width: 390px)');
  });

  it('preserves Phase 8 material and Phase 9 header boundaries', () => {
    const contract = readRelative('../../docs/PREMIUM_VISUAL_LANGUAGE_CONTRACT.md');
    const phase9 = readRelative('../../docs/PHASE9_HEADER_NAVIGATION_PLAN.md');

    expect(contract).toContain('CANONICAL — HIERARCHY / MATERIAL SEPARATION');
    expect(contract).toContain('Hierarchy classes must never redefine material');
    expect(phase9).toContain('PHASE 9 SOURCE-FROZEN');
  });
});
