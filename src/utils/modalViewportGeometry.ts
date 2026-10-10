/**
 * Coordinates used by fixed-position overlays are *layout viewport* relative.
 * On iOS WebKit, visualViewport.offsetTop can transiently reflect a document
 * scroll/toolbar transition when the body is locked. Never allow that number
 * to place a modal outside the currently visible layout viewport.
 *
 * This is geometry only: it does not alter modal scrolling, form behavior,
 * animation, or the sticky footer.
 */
export interface ModalViewportInput {
  layoutWidth: number;
  layoutHeight: number;
  visualWidth: number;
  visualHeight: number;
  offsetLeft: number;
  offsetTop: number;
}

export interface ModalViewportRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const positive = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback;
const bounded = (value: number, max: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(0, value), max) : 0;

/** The visual viewport must be contained within the layout viewport. */
export function modalViewportRect(input: ModalViewportInput): ModalViewportRect {
  const layoutWidth = positive(input.layoutWidth, 1);
  const layoutHeight = positive(input.layoutHeight, 1);
  const width = Math.min(positive(input.visualWidth, layoutWidth), layoutWidth);
  const height = Math.min(positive(input.visualHeight, layoutHeight), layoutHeight);

  return {
    left: bounded(input.offsetLeft, Math.max(0, layoutWidth - width)),
    top: bounded(input.offsetTop, Math.max(0, layoutHeight - height)),
    width,
    height,
  };
}
