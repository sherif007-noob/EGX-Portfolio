import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export type MotionSwapVariant = 'tab' | 'state';

interface MotionSwapProps {
  motionKey: string | number;
  children: React.ReactNode;
  variant?: MotionSwapVariant;
  className?: string;
  onEnterComplete?: (motionKey: string | number) => void;
}

const EASE_OUT = [0.22, 0.8, 0.24, 1] as const;
const EASE_IN = [0.4, 0, 0.7, 0.2] as const;

function useDesktopMotionPerformanceMode(): boolean {
  const query = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';
  const [matches, setMatches] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return matches;
}

const SWAP_MOTION = {
  tab: {
    initial: { opacity: 0, x: 22, y: 5, scale: 0.996 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, x: -18, y: -3, scale: 0.998 },
    enterDuration: 0.44,
    exitDuration: 0.28,
    enterDelay: 0.055,
  },
  state: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -7 },
    enterDuration: 0.36,
    exitDuration: 0.22,
    enterDelay: 0.045,
  },
} as const;

/**
 * Canonical page/result presence primitive.
 *
 * Motion's AnimatePresence owns lifecycle. No browser screenshots, timers,
 * cached React trees, or permanent GPU layers are involved.
 */
export const MotionSwap: React.FC<MotionSwapProps> = ({
  motionKey,
  children,
  variant = 'state',
  className = '',
  onEnterComplete,
}) => {
  const reduceMotion = useReducedMotion();
  const desktopPerformanceMode = useDesktopMotionPerformanceMode();
  const config = SWAP_MOTION[variant];
  const animateLayout =
    !reduceMotion && variant === 'state' && !desktopPerformanceMode;

  const initialState =
    desktopPerformanceMode && variant === 'tab'
      ? { ...config.initial, scale: 1 }
      : config.initial;

  const exitState =
    desktopPerformanceMode && variant === 'tab'
      ? { ...config.exit, scale: 1 }
      : config.exit;

  const animateState =
    variant === 'tab'
      ? { opacity: 1, x: 0, y: 0, scale: 1 }
      : { opacity: 1, y: 0 };

  return (
    <motion.div
      className={`premium-motion-swap-shell premium-motion-swap-shell--${variant}`}
      data-motion-shell={variant}
      data-motion-desktop={desktopPerformanceMode ? 'optimized' : undefined}
      layout={animateLayout ? 'size' : false}
      layoutDependency={animateLayout ? motionKey : undefined}
      transition={{
        layout: {
          duration: reduceMotion ? 0 : 0.38,
          ease: EASE_OUT,
        },
      }}
      style={{ position: 'relative', width: '100%' }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={String(motionKey)}
          className={`premium-motion-swap premium-motion-swap--${variant} ${className}`.trim()}
          data-motion-owned="react"
          layout={animateLayout ? 'position' : false}
          initial={reduceMotion ? { opacity: 0 } : initialState}
          animate={{
            ...animateState,
            transition: {
              duration: reduceMotion ? 0.14 : config.enterDuration,
              delay: reduceMotion ? 0 : config.enterDelay,
              ease: EASE_OUT,
            },
          }}
          exit={
            reduceMotion
              ? {
                  opacity: 0,
                  transition: { duration: 0.1, ease: 'easeIn' },
                }
              : {
                  ...exitState,
                  transition: {
                    duration: config.exitDuration,
                    ease: EASE_IN,
                  },
                }
          }
          onAnimationComplete={() => {
            if (variant === 'tab') onEnterComplete?.(motionKey);
          }}
          style={{
            width: '100%',
            transformOrigin: 'top center',
            pointerEvents: 'auto',
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

interface PremiumModalMotionProps {
  isOpen: boolean;
  children: React.ReactNode;
  backdropClassName: string;
  panelClassName: string;
  onBackdropClick?: () => void;
  panelAriaLabel?: string;
}

/**
 * Shared modal lifecycle primitive. Backdrop and panel are actual DOM nodes,
 * both kept present by AnimatePresence until exit finishes.
 */
export const PremiumModalMotion: React.FC<PremiumModalMotionProps> = ({
  isOpen,
  children,
  backdropClassName,
  panelClassName,
  onBackdropClick,
  panelAriaLabel,
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="premium-modal-backdrop"
          className={backdropClassName}
          data-motion-owned="react"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: reduceMotion ? 0.14 : 0.32, ease: EASE_OUT },
          }}
          exit={{
            opacity: 0,
            transition: { duration: reduceMotion ? 0.12 : 0.27, ease: EASE_IN },
          }}
          onMouseDown={onBackdropClick}
        >
          <motion.div
            className={panelClassName}
            data-motion-owned="react"
            role={panelAriaLabel ? 'dialog' : undefined}
            aria-label={panelAriaLabel}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 26, scale: 0.965 }
            }
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                duration: reduceMotion ? 0.16 : 0.42,
                ease: EASE_OUT,
              },
            }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0.12 } }
                : {
                    opacity: 0,
                    y: 16,
                    scale: 0.978,
                    transition: { duration: 0.3, ease: EASE_IN },
                  }
            }
            onMouseDown={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface DropdownPresenceProps {
  isOpen: boolean;
  children: React.ReactNode;
  className: string;
  role?: React.AriaRole;
  dataAccent?: string;
}

/**
 * Canonical floating-menu lifecycle. The menu animates as one surface; rows do
 * not stagger independently.
 */
export const DropdownPresence: React.FC<DropdownPresenceProps> = ({
  isOpen,
  children,
  className,
  role,
  dataAccent,
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="dropdown"
          role={role}
          className={className}
          data-accent={dataAccent}
          data-motion-owned="react"
          style={{ transformOrigin: 'top center' }}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.975 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: reduceMotion ? 0.14 : 0.36,
              ease: EASE_OUT,
            },
          }}
          exit={{
            opacity: 0,
            y: reduceMotion ? 0 : -6,
            scale: reduceMotion ? 1 : 0.985,
            transition: {
              duration: reduceMotion ? 0.1 : 0.24,
              ease: EASE_IN,
            },
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface SurfacePresenceProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Small conditional surface/banner presence. Unlike MotionSwap, this doesn't
 * replace a keyed result tree; it simply gives localized UI a matched
 * enter/exit without replaying page-level motion.
 */
export const SurfacePresence: React.FC<SurfacePresenceProps> = ({
  isOpen,
  children,
  className = '',
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="surface"
          className={className}
          data-motion-owned="react"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.992 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration: reduceMotion ? 0.14 : 0.26,
              ease: EASE_OUT,
            },
          }}
          exit={{
            opacity: 0,
            y: reduceMotion ? 0 : -4,
            scale: reduceMotion ? 1 : 0.995,
            transition: {
              duration: reduceMotion ? 0.1 : 0.18,
              ease: EASE_IN,
            },
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ExpandPresenceProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Localized accordion/conditional reveal. Height animation is restricted to
 * the small expandable region rather than a full page/report.
 */
export const ExpandPresence: React.FC<ExpandPresenceProps> = ({
  isOpen,
  children,
  className = '',
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="expanded"
          className={className}
          data-motion-owned="react"
          initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0, y: -4 }}
          animate={{
            height: 'auto',
            opacity: 1,
            y: 0,
            transition: {
              height: { duration: reduceMotion ? 0.01 : 0.3, ease: EASE_OUT },
              opacity: { duration: reduceMotion ? 0.14 : 0.24, ease: 'easeOut' },
              y: { duration: reduceMotion ? 0.01 : 0.28, ease: EASE_OUT },
            },
          }}
          exit={{
            height: 0,
            opacity: 0,
            y: -3,
            transition: {
              height: { duration: reduceMotion ? 0.01 : 0.24, ease: EASE_IN },
              opacity: { duration: reduceMotion ? 0.1 : 0.16, ease: 'easeIn' },
              y: { duration: reduceMotion ? 0.01 : 0.2, ease: EASE_IN },
            },
          }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
