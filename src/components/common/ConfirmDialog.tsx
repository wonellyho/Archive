import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible confirmation modal. Escape cancels; backdrop click cancels. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "삭제",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-line bg-paper p-6 shadow-xl"
      >
        <h2 id="confirm-title" className="text-xl font-medium text-ink">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 text-base text-ink-soft">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-5 py-2.5 text-base text-ink-soft transition-colors hover:bg-cream hover:text-ink"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="rounded-full bg-accent px-5 py-2.5 text-base font-medium text-paper transition-transform hover:scale-[1.03] active:scale-95"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
