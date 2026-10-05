import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readRelative = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('Phase 9.8 interaction / focus / motion closure', () => {
  it('keeps explicit hover and keyboard-focus treatment for navigation and commands', () => {
    const css = readRelative('../styles/features/header.css');

    expect(css).toContain('.premium-nav-item.premium-nav-idle:hover');
    expect(css).toContain('.premium-nav-item:focus-visible');
    expect(css).toContain('.premium-header-action:hover:not(:disabled)');
    expect(css).toContain('.premium-header-action:focus-visible');
    expect(css).toContain('.premium-header-tools-item:focus-visible');
  });

  it('preserves keyboard navigation and menu disclosure semantics', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(header).toContain('nextTab?.focus()');
    expect(header).toContain('aria-current={active ? \'page\' : undefined}');
    expect(header).toContain('aria-haspopup="menu"');
    expect(header).toContain('aria-expanded={isDataToolsOpen}');
    expect(header).toContain("if (event.key === 'Escape') setIsDataToolsOpen(false)");
  });

  it('keeps status motion purposeful and respects reduced motion', () => {
    const header = readRelative('./Header.tsx');
    const legacy = readRelative('../styles/features/header.css');
    const controls = readRelative('../styles/controls.css');
    const motion = readRelative('../styles/motion.css');
    const css = [legacy, controls, motion].join('\n');

    expect(header).toContain("isSyncingPrices ? 'animate-spin' : ''");
    expect(header).toContain('premium-motion-chevron');
    expect(header).not.toContain('animate-bounce');

    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.premium-header-action-running .animate-spin');
    expect(css).toContain('animation: none !important');
    expect(css).toContain('.premium-nav-scroller');
    expect(css).toContain('scroll-behavior: auto !important');
  });

  it('keeps warning and connected states local rather than adding theatrical motion', () => {
    const header = readRelative('./Header.tsx');

    expect(header).toContain('premium-header-status-badge-amber');
    expect(header).toContain('premium-header-status-dot-connected');
    expect(header).toContain('premium-header-status-dot-warning');
    expect(header).toContain('premium-header-status-dot-running');
    expect(header).toContain('premium-header-status-dot-muted');
  });

  it('does not reopen Phase 8 material or content hierarchy', () => {
    const css = [readRelative('../styles/features/header.css'), readRelative('../styles/semantics.css')].join('\n');

    expect(css).toContain('Pass 8.3b: intensified resting aura/glow');
    expect(css).toContain('Additive semantic edge — aura/glass remain untouched');
    expect(css).toContain('--premium-semantic-role-near-radius: 48px;');
    expect(css).toContain('--premium-semantic-role-near-alpha: 0.34;');
  });
});
