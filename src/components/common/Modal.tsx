import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width utility for the card. Defaults to a compact form size. */
  widthClassName?: string;
}

/** Generic modal shell: backdrop, centered card, Escape + backdrop-click close. */
export function Modal({
  open,
  title,
  onClose,
  children,
  widthClassName = "max-w-lg",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Portal to <body> so a `position: fixed` overlay escapes any ancestor that
  // creates a containing block (e.g. the nav's backdrop-blur), staying truly
  // full-screen instead of being trapped inside that ancestor.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`glass modal-surface my-auto w-full ${widthClassName} rounded-3xl border border-[color:var(--surface-border)] p-6 font-serif shadow-xl sm:p-8`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-medium text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-3 py-1.5 text-base text-ink-faint transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
