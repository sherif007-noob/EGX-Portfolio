export interface DropdownAnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
}

export interface DropdownViewport {
  left: number;
  top: number;
  width: number;
  height: number;
  layoutHeight: number;
}

export interface DropdownGeometryOptions {
  matchAnchorWidth: boolean;
  preferredWidth?: number;
  align: 'left' | 'right' | 'auto';
  offset: number;
  gutter: number;
}

export interface DropdownViewportGeometry {
  left: number;
  width: number;
  maxWidth: number;
  maxHeight: number;
  placement: 'below' | 'above';
  top: number | 'auto';
  bottom: number | 'auto';
}

export function computeDropdownViewportGeometry(
  anchor: DropdownAnchorRect,
  viewport: DropdownViewport,
  options: DropdownGeometryOptions,
): DropdownViewportGeometry {
  const safeLeft = viewport.left + options.gutter;
  const safeRight = viewport.left + viewport.width - options.gutter;
  const safeTop = viewport.top + options.gutter;
  const safeBottom = viewport.top + viewport.height - options.gutter;
  const availableWidth = Math.max(0, safeRight - safeLeft);

  const desiredWidth = options.matchAnchorWidth
    ? anchor.width
    : Math.max(anchor.width, options.preferredWidth ?? 240);
  const width = Math.min(Math.max(0, desiredWidth), availableWidth);

  const leftAligned = anchor.left;
  const rightAligned = anchor.right - width;
  const preferredLeft =
    options.align === 'left'
      ? leftAligned
      : options.align === 'right'
        ? rightAligned
        : leftAligned + width <= safeRight
          ? leftAligned
          : rightAligned;

  const maxLeft = Math.max(safeLeft, safeRight - width);
  const left = Math.min(Math.max(safeLeft, preferredLeft), maxLeft);

  const availableBelow = Math.max(0, safeBottom - (anchor.bottom + options.offset));
  const availableAbove = Math.max(0, anchor.top - options.offset - safeTop);
  const placement =
    availableBelow >= 180 || availableBelow >= availableAbove ? 'below' : 'above';
  const maxHeight = placement === 'below' ? availableBelow : availableAbove;

  return {
    left,
    width,
    maxWidth: availableWidth,
    maxHeight,
    placement,
    top: placement === 'below' ? anchor.bottom + options.offset : 'auto',
    bottom:
      placement === 'above'
        ? Math.max(options.gutter, viewport.layoutHeight - anchor.top + options.offset)
        : 'auto',
  };
}
