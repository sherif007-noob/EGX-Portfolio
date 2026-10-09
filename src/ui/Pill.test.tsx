// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { PillGroup } from './Pill';
import { readFileSync } from 'node:fs';
import { sectorColorVar } from './format';

// React's test environment uses act to flush event-driven state changes.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('shared PillGroup', () => {
  it('changes one selected string choice and preserves keyboard-native buttons', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    function Example() {
      const [value, setValue] = useState<'a' | 'b'>('a');
      return <PillGroup label="View" value={value} onChange={setValue}
        choices={[{value:'a',label:'First'},{value:'b',label:'Second'}]}/>;
    }
    try {
      await act(async () => root.render(<Example/>));
      const buttons = host.querySelectorAll('button');
      expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
      expect(buttons[1].type).toBe('button');
      await act(async () => buttons[1].click());
      expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
      expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
      expect(host.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('View');
      expect(host.querySelector('[style]')).toBeNull();
    } finally { await act(async () => root.unmount()); }
  });

  it('passes numeric chart intervals without converting them into strings', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const onChange = vi.fn();
    try {
      await act(async () => root.render(<PillGroup label="Interval" value={1} onChange={onChange}
        choices={[{value:1,label:'1m'},{value:5,label:'5m'}]}/>));
      await act(async () => host.querySelectorAll('button')[1].click());
      expect(onChange).toHaveBeenCalledWith(5);
    } finally { await act(async () => root.unmount()); }
  });

  it('keeps categorical sector colors distinct from semantic colors', () => {
    const css = readFileSync(`${process.cwd()}/src/ui/ui.css`, 'utf8');
    const categoryColors = [...css.matchAll(/--ui-cat-\d:\s*(#[a-f0-9]+);/g)].map(match=>match[1]);
    const semanticColors = [...css.matchAll(/--ui-(?:teal|blue|purple|amber|coral|gray):\s*(#[a-f0-9]+);/g)].map(match=>match[1]);
    expect(new Set(categoryColors).size).toBe(8);
    expect(categoryColors.some(color=>semanticColors.includes(color))).toBe(false);
    expect(sectorColorVar('Banking')).toMatch(/^var\(--ui-cat-[1-8]\)$/);
  });
});
