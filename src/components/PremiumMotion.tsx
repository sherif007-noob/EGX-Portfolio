import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export type MotionSwapVariant = 'tab' | 'state';

interface MotionSwapProps {
  motionKey: string | number;
  children: React.ReactNode;
  variant?: MotionSwapVariant;
  className?: string;
}

const EASE_OUT = [0.22, 0.8, 0.24, 1] as const;
const EASE_IN = [0.4, 0, 0.7, 0.2] as const;

const SWAP_MOTION = {
  tab: {
    initial: { opacity: 0.38, x: 14, y: 3 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0.38, x: -12, y: -2 },
    enterDuration: 0.38,
    exitDuration: 0.22,
  },
  state: {
    initial: { opacity: 0.44, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0.44, y: -6 },
    enterDuration: 0.31,
    exitDuration: 0.18,
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
}) => {
  const reduceMotion = useReducedMotion();
  const config = SWAP_MOTION[variant];

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={String(motionKey)}
        className={`premium-motion-swap premium-motion-swap--${variant} ${className}`.trim()}
        data-motion-owned="react"
        initial={
          reduceMotion
            ? { opacity: 0 }
            : config.initial
        }
        animate={{
          opacity: 1,
          x: 0,
          y: 0,
          transition: {
            duration: reduceMotion ? 0.16 : config.enterDuration,
            ease: EASE_OUT,
          },
        }}
        exit={
          reduceMotion
            ? {
                opacity: 0,
                transition: { duration: 0.12, ease: 'easeIn' },
              }
            : {
                ...config.exit,
                transition: {
                  duration: config.exitDuration,
                  ease: EASE_IN,
                },
              }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
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
            transition: { duration: reduceMotion ? 0.14 : 0.24, ease: 'easeOut' },
          }}
          exit={{
            opacity: 0,
            transition: { duration: reduceMotion ? 0.12 : 0.22, ease: 'easeIn' },
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
                : { opacity: 0, y: 18, scale: 0.972 }
            }
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                duration: reduceMotion ? 0.16 : 0.33,
                ease: EASE_OUT,
              },
            }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0.12 } }
                : {
                    opacity: 0,
                    y: 12,
                    scale: 0.982,
                    transition: { duration: 0.24, ease: EASE_IN },
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

/**
 * Compatibility hook retained temporarily for modal components not yet
 * migrated to PremiumModalMotion. It no longer drives app-content swaps.
 */
export function useMotionPresence(isOpen: boolean) {
  return { isPresent: isOpen, phase: 'idle' as const };
}
