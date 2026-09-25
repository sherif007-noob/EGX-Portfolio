import React from 'react';

export type HierarchyLevel = 'h0' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5';

export type HierarchyTextRole =
  | 'page-title'
  | 'section-title'
  | 'metric'
  | 'metric-label'
  | 'metadata'
  | 'helper';

export type ActionPriority =
  | 'primary'
  | 'secondary'
  | 'utility'
  | 'destructive';

const SURFACE_CLASS: Record<HierarchyLevel, string> = {
  h0: 'premium-hierarchy-h0',
  h1: 'premium-hierarchy-h1',
  h2: 'premium-hierarchy-h2',
  h3: 'premium-hierarchy-h3',
  h4: 'premium-hierarchy-h4',
  h5: 'premium-hierarchy-h5',
};

const TEXT_CLASS: Record<HierarchyTextRole, string> = {
  'page-title': 'premium-type-page-title',
  'section-title': 'premium-type-section-title',
  metric: 'premium-type-metric',
  'metric-label': 'premium-type-metric-label',
  metadata: 'premium-type-metadata',
  helper: 'premium-type-helper',
};

const ACTION_CLASS: Record<ActionPriority, string> = {
  primary: 'premium-action-priority-primary',
  secondary: 'premium-action-priority-secondary',
  utility: 'premium-action-priority-utility',
  destructive: 'premium-action-priority-destructive',
};

export const getHierarchySurfaceClass = (level: HierarchyLevel): string =>
  SURFACE_CLASS[level];

export const getHierarchyTextClass = (role: HierarchyTextRole): string =>
  TEXT_CLASS[role];

export const getActionPriorityClass = (priority: ActionPriority): string =>
  ACTION_CLASS[priority];

type SurfaceTag = 'div' | 'section' | 'article' | 'aside';

interface HierarchySurfaceProps extends React.HTMLAttributes<HTMLElement> {
  level: HierarchyLevel;
  as?: SurfaceTag;
}

export const HierarchySurface: React.FC<HierarchySurfaceProps> = ({
  level,
  as = 'div',
  className = '',
  children,
  ...props
}) => {
  const Component = as as React.ElementType;

  return (
    <Component
      {...props}
      data-hierarchy={level}
      className={['premium-hierarchy-surface', SURFACE_CLASS[level], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Component>
  );
};

type TextTag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';

interface HierarchyTextProps extends React.HTMLAttributes<HTMLElement> {
  role: HierarchyTextRole;
  as?: TextTag;
}

export const HierarchyText: React.FC<HierarchyTextProps> = ({
  role,
  as = 'span',
  className = '',
  children,
  ...props
}) => {
  const Component = as as React.ElementType;

  return (
    <Component
      {...props}
      data-hierarchy-text={role}
      className={[TEXT_CLASS[role], className].filter(Boolean).join(' ')}
    >
      {children}
    </Component>
  );
};
