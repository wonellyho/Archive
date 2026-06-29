import type { ReactNode } from "react";

interface StageObjectButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  icon: ReactNode;
}

/**
 * A large, tactile object the visitor clicks to open a mode. Deliberately not a
 * plain menu button — it reads as a physical object in the room.
 */
export function StageObjectButton({
  active,
  onClick,
  title,
  subtitle,
  icon,
}: StageObjectButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`group flex flex-1 flex-col items-center gap-3 rounded-2xl border p-6 text-center transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active
          ? "border-accent/60 bg-paper/5"
          : "border-paper/15 hover:-translate-y-0.5 hover:border-paper/40"
      }`}
    >
      <span
        className="text-5xl transition-transform group-hover:scale-105"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-medium text-paper">{title}</span>
        <span className="text-xs text-muted">{subtitle}</span>
      </span>
    </button>
  );
}
