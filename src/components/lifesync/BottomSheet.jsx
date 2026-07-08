import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  MotionDiv,
  lifeSyncDetailOverlayFadeTransition,
} from "../../lib/lifesyncMotion";

/**
 * Mobile filter sheet — slides up from the bottom, drag-to-dismiss. Same
 * prop shape as the desktop `FilterDrawer`/`LibraryFilterDrawer` side
 * panels so source-specific filter bodies pass through unchanged.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  count,
  onReset,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <MotionDiv
          className="fixed inset-0 z-9997 flex items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={lifeSyncDetailOverlayFadeTransition}
        >
          <MotionDiv
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <MotionDiv
            className="relative flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-(--color-surface)/70 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose?.();
            }}
          >
            <div className="mx-auto mt-2.5 h-1.25 w-10 shrink-0 rounded-full bg-(--color-border-strong)" />
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-[15px] font-black text-(--color-text-primary)">
                  {title}
                </h2>
                {count > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-black tabular-nums text-(--color-ink-strong)">
                    {count}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {count > 0 && onReset && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="min-h-11 rounded-lg border border-(--color-border-soft) px-2.5 text-[11px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close filters"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              {children}
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>,
    document.body,
  );
}
