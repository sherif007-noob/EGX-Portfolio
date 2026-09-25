import { describe, expect, it } from 'vitest';
import {
  getActionPriorityClass,
  getHierarchySurfaceClass,
  getHierarchyTextClass,
  type ActionPriority,
  type HierarchyLevel,
  type HierarchyTextRole,
} from './VisualHierarchy';

describe('Phase 8 visual hierarchy primitives', () => {
  it('maps every H0-H5 level to one canonical structural class', () => {
    const levels: HierarchyLevel[] = ['h0', 'h1', 'h2', 'h3', 'h4', 'h5'];
    expect(levels.map(getHierarchySurfaceClass)).toEqual([
      'premium-hierarchy-h0',
      'premium-hierarchy-h1',
      'premium-hierarchy-h2',
      'premium-hierarchy-h3',
      'premium-hierarchy-h4',
      'premium-hierarchy-h5',
    ]);
  });

  it('maps every typography role to one canonical class', () => {
    const roles: HierarchyTextRole[] = [
      'page-title',
      'section-title',
      'metric',
      'metric-label',
      'metadata',
      'helper',
    ];

    expect(roles.map(getHierarchyTextClass)).toEqual([
      'premium-type-page-title',
      'premium-type-section-title',
      'premium-type-metric',
      'premium-type-metric-label',
      'premium-type-metadata',
      'premium-type-helper',
    ]);
  });

  it('keeps action priority independent from semantic color', () => {
    const priorities: ActionPriority[] = [
      'primary',
      'secondary',
      'utility',
      'destructive',
    ];

    const classes = priorities.map(getActionPriorityClass);
    expect(classes).toEqual([
      'premium-action-priority-primary',
      'premium-action-priority-secondary',
      'premium-action-priority-utility',
      'premium-action-priority-destructive',
    ]);

    for (const className of classes) {
      expect(className).not.toMatch(/emerald|rose|amber|cyan|blue|purple/);
    }
  });
});
