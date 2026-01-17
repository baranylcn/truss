import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lightweight, dependency-free tooltip with portal + auto placement.
 * - Positions relative to the trigger, rendered into document.body (fixed)
 * - Auto placement (bottom -> top -> right -> left) with viewport clamping
 * - Max width to avoid tall, narrow tooltips (defaults to 420px)
 * - Small delay on mouse leave to make it forgiving
 */
export interface InfoTipProps {
  text: string;
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
  className?: string;
  iconClassName?: string;
  ariaLabel?: string;
}

const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

export const InfoTip: React.FC<InfoTipProps> = ({
  text,
  placement = 'auto',
  maxWidth = 420,
  className = '',
  iconClassName = '',
  ariaLabel = 'info'
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; place: 'top' | 'bottom' | 'left' | 'right' } | null>(null);

  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const openTip = () => {
    clearTimer();
    setOpen(true);
  };

  const closeTip = () => {
    clearTimer();
    timeoutRef.current = window.setTimeout(() => setOpen(false), 120);
  };

  const computePosition = () => {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;

    const ar = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // First measure with a reasonable width
    // (tip.offsetWidth may be 0 before rendered; use maxWidth as fallback)
    const tw = Math.min(maxWidth, tip.offsetWidth || maxWidth);
    const th = tip.offsetHeight || 0;
    const margin = 10;

    // Default: bottom centered
    let place: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    let top = ar.bottom + margin;
    let left = clamp(ar.left + ar.width / 2 - tw / 2, 8, vw - tw - 8);

    const notEnoughBottom = top + th > vh - 8;
    if (placement === 'auto') {
      if (notEnoughBottom) {
        // Try top
        const tryTop = ar.top - th - margin;
        if (tryTop >= 8) {
          place = 'top';
          top = tryTop;
          left = clamp(ar.left + ar.width / 2 - tw / 2, 8, vw - tw - 8);
        } else {
          // Try right
          const tryRight = ar.right + margin;
          if (tryRight + tw <= vw - 8) {
            place = 'right';
            left = tryRight;
            top = clamp(ar.top + ar.height / 2 - th / 2, 8, vh - th - 8);
          } else {
            // Fallback left
            const tryLeft = ar.left - tw - margin;
            place = 'left';
            left = Math.max(8, tryLeft);
            top = clamp(ar.top + ar.height / 2 - th / 2, 8, vh - th - 8);
          }
        }
      }
    } else {
      // Forced placement
      switch (placement) {
        case 'top':
          place = 'top';
          top = ar.top - th - margin;
          left = clamp(ar.left + ar.width / 2 - tw / 2, 8, vw - tw - 8);
          break;
        case 'right':
          place = 'right';
          left = ar.right + margin;
          top = clamp(ar.top + ar.height / 2 - th / 2, 8, vh - th - 8);
          break;
        case 'left':
          place = 'left';
          left = Math.max(8, ar.left - tw - margin);
          top = clamp(ar.top + ar.height / 2 - th / 2, 8, vh - th - 8);
          break;
        case 'bottom':
        default:
          place = 'bottom';
          top = ar.bottom + margin;
          left = clamp(ar.left + ar.width / 2 - tw / 2, 8, vw - tw - 8);
      }
    }

    setCoords({ top, left, place });
  };

  // Recompute on open, resize, scroll, text change
  useEffect(() => {
    if (!open) return;
    // Wait a frame to ensure the tip is in the DOM and sized
    const id = requestAnimationFrame(computePosition);
    const onResize = () => computePosition();
    const onScroll = () => computePosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement, maxWidth, text]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onMouseEnter={openTip}
        onMouseLeave={closeTip}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-500/60 text-gray-300 hover:text-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${iconClassName}`}
        aria-label={ariaLabel}
      >
        <span className="text-[10px] leading-none font-semibold">i</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={tipRef}
            onMouseEnter={openTip}
            onMouseLeave={closeTip}
            className={`fixed z-[9999] pointer-events-auto select-none ${className}`}
            style={{
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              maxWidth
            }}
            role="tooltip"
          >
            <div className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-200 shadow-xl leading-relaxed whitespace-normal">
              {text}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default InfoTip;
