import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivitySwitcher, ACTIVITY_TABS } from './SimpleShell';

describe('Medium UI Activity navigation', () => {
  it('keeps the three existing ledger destinations without a new data path', () => {
    expect(ACTIVITY_TABS).toEqual(['journal', 'cash', 'closed_cycles']);
  });

  it('renders a responsive, accessible tab group with the correct active selection', () => {
    const html = renderToStaticMarkup(
      <ActivitySwitcher activeTab="cash" setActiveTab={() => {}} />,
    );
    expect(html).toContain('aria-label="Activity navigation"');
    expect(html).toContain('aria-label="Activity view"');
    expect(html).toContain('Transactions');
    expect(html).toContain('Cash');
    expect(html).toContain('Closed');
    expect((html.match(/<button/g) ?? []).length).toBe(3);
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Cash<\/button>/);
  });
});
